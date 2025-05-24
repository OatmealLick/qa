document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    const firebaseConfig = {
	apiKey: "AIzaSyBAmQahXdsEf1l6V-GWHpDwp3AoaoRcIjQ",
	authDomain: "wookash-qa.firebaseapp.com",
	projectId: "wookash-qa",
	storageBucket: "wookash-qa.firebasestorage.app",
	messagingSenderId: "580430017957",
	appId: "1:580430017957:web:1f2de24a8739ee7cb4a44c"
    };

    // --- Initialize Firebase ---
    // Using compat libraries for easier integration with existing structure
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth(); // Get the auth instance
    const db = firebase.firestore(); // Get the Firestore instance

    // --- DOM References ---
    const questionForm = document.getElementById('add-question-form');
    const questionInput = document.getElementById('question-input');
    const addQuestionButton = document.getElementById('add-question-button');
    const questionsList = document.getElementById('questions-list');

    const googleSignInButton = document.getElementById('google-signin-button');
    const signOutButton = document.getElementById('signout-button');
    const userInfoDiv = document.getElementById('user-info');
    const userDetailsP = document.getElementById('user-details');

    const githubSignInButton = document.getElementById('github-signin-button'); 
    const facebookSignInButton = document.getElementById('facebook-signin-button'); 
    // References for Microsoft, X, and Apple buttons removed.

    // let questions = []; // Local questions array removed, Firestore is the source of truth.
    let userVotes = {}; // Object to track user votes { questionId: true/false } - for client-side UI state
    let questionsListener = null; // To hold the Firestore listener unsubscribe function

    let currentUser = null; // To store the current authenticated user object

    // --- Auth State Observer ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            // User is signed in
            userDetailsP.textContent = `Logged in as: ${user.displayName || user.email}`;
            userInfoDiv.style.display = 'block';
            googleSignInButton.style.display = 'none';
            githubSignInButton.style.display = 'none'; 
            facebookSignInButton.style.display = 'none'; 
            // Display logic for Microsoft, X, and Apple buttons removed.
            signOutButton.style.display = 'block';

            questionInput.disabled = false;
            addQuestionButton.disabled = false;
            questionsList.style.display = ''; // Or 'block', 'flex' etc. depending on CSS
            // renderQuestions(); // Replaced by Firestore listener
            if (questionsListener) { // Detach any old listener
                questionsListener();
            }
            loadQuestionsFromFirestore(); // Setup new listener
        } else {
            // User is signed out
            if (questionsListener) { // Detach listener if user signs out
                questionsListener();
                questionsListener = null;
            }
            userDetailsP.textContent = '';
            userInfoDiv.style.display = 'none';
            googleSignInButton.style.display = 'block';
            githubSignInButton.style.display = 'block'; 
            facebookSignInButton.style.display = 'block'; 
            // Display logic for Microsoft, X, and Apple buttons removed.
            signOutButton.style.display = 'none';

            questionInput.disabled = true;
            addQuestionButton.disabled = true;
            questionsList.innerHTML = ''; // Clear questions from display
            questionsList.style.display = 'none'; // Hide the list container
            // It's also good practice to clear the actual 'questions' array 
            // if questions should not persist in memory after logout.
            // For now, just hiding and clearing display is requested.
            // questions = []; // Uncomment if questions should be wiped from memory on logout
        }
        // renderQuestions() was here, moved into the if(user) block
    });

    // --- Sign-In with Google ---
    googleSignInButton.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then((result) => {
                // This gives you a Google Access Token. You can use it to access the Google API.
                // const credential = result.credential;
                // const token = credential.accessToken;
                // const user = result.user;
                // console.log('Signed in user:', user);
            })
            .catch((error) => {
                // Handle Errors here.
                console.error("Google Sign-In Error:", error.code, error.message);
                // const errorCode = error.code;
                // const errorMessage = error.message;
                // const email = error.customData.email;
                // const credential = firebase.auth.GoogleAuthProvider.credentialFromError(error);
            });
    });

    // --- Sign-Out ---
    signOutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            // Sign-out successful.
            // console.log('User signed out');
        }).catch((error) => {
            console.error("Sign-Out Error:", error);
        });
    });

    // --- Sign-In with GitHub ---
    githubSignInButton.addEventListener('click', () => {
        const provider = new firebase.auth.GithubAuthProvider();
        // You can add custom scopes if needed:
        // provider.addScope('repo'); // Example scope
        auth.signInWithPopup(provider)
            .then((result) => {
                // const user = result.user;
                // console.log('Signed in with GitHub:', user);
            })
            .catch((error) => {
                console.error("GitHub Sign-In Error:", error.code, error.message);
                 if (error.code === 'auth/account-exists-with-different-credential') {
                    alert('An account already exists with the same email address but different sign-in credentials. Try signing in using a method you used previously.');
                } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
                    // User closed the popup
                } else {
                    alert(`Error signing in with GitHub: ${error.message}`);
                }
            });
    });

    // --- Sign-In with Facebook ---
    facebookSignInButton.addEventListener('click', () => {
        const provider = new firebase.auth.FacebookAuthProvider();
        // You can add scopes if needed, e.g., provider.addScope('email');
        auth.signInWithPopup(provider)
            .then((result) => {
                // const user = result.user;
                // console.log('Signed in with Facebook:', user);
            })
            .catch((error) => {
                console.error("Facebook Sign-In Error:", error.code, error.message);
                if (error.code === 'auth/account-exists-with-different-credential') {
                    alert('An account already exists with the same email address but different sign-in credentials. Try signing in using a method you used previously.');
                } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
                    // User closed the popup - typically not an error to show them
                } else {
                    alert(`Error signing in with Facebook: ${error.message}`);
                }
            });
    });

    // Event listener for Apple sign-in button removed.

    // --- Load Questions from Firestore ---
    function loadQuestionsFromFirestore() {
        if (!currentUser) { // Should already be handled by where this is called from
            questionsList.innerHTML = '';
            questionsList.style.display = 'none';
            return;
        }
        questionsList.style.display = ''; // Or 'block', 'flex'

        // Detach any existing listener by calling the variable that holds the unsubscribe function
        if (questionsListener) {
            questionsListener();
        }

        questionsListener = db.collection("questions").orderBy("createdAt", "desc") // Assuming you add 'createdAt' field
            .onSnapshot((snapshot) => {
                const questionsData = [];
                snapshot.forEach((doc) => {
                    questionsData.push({ id: doc.id, ...doc.data() });
                });
                renderQuestions(questionsData); // Pass data to renderQuestions
            }, (error) => {
                console.error("Error fetching questions: ", error);
                // Handle error, maybe show a message to the user
                questionsList.innerHTML = '<p>Error loading questions. Please try again later.</p>';
            });
    }

    // --- Render Questions ---
    function renderQuestions(questionsData) { // Modified to accept questionsData
        questionsList.innerHTML = ''; // Clear existing questions

        questionsData.forEach(question => { // Operates on questionsData
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item');
            questionItem.dataset.id = question.id;

            const questionText = document.createElement('p');
            questionText.classList.add('question-text');
            // Make sure question.text exists, especially if there are DB schema inconsistencies
            questionText.textContent = question.text || "[No question text]"; 
            // Author name display removed as per requirement


            const questionActions = document.createElement('div');
            questionActions.classList.add('question-actions');

            const voteButton = document.createElement('button');
            voteButton.classList.add('vote-button');
            voteButton.textContent = `Upvote (${question.votes})`;
            if (userVotes[question.id]) {
                voteButton.classList.add('voted');
            }
            voteButton.addEventListener('click', () => handleUpvote(question.id)); // Votes no longer passed

            const removeButton = document.createElement('button');
            removeButton.classList.add('remove-button');
            removeButton.textContent = 'Remove';
            
            // Only show remove button if the user is logged in and owns the question
            if (currentUser && currentUser.uid === question.userId) {
                removeButton.style.display = 'inline-block';
                removeButton.addEventListener('click', () => handleRemove(question.id));
            } else {
                removeButton.style.display = 'none';
            }

            questionActions.appendChild(voteButton);
            questionActions.appendChild(removeButton);

            questionItem.appendChild(questionText);
            questionItem.appendChild(questionActions);
            questionsList.appendChild(questionItem);
        });
    }

    // --- Add Question ---
    questionForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = questionInput.value.trim();
        if (text && currentUser) { // Only allow adding if logged in
            // const newQuestion = { // Old local object creation
            //     id: crypto.randomUUID(),
            //     text: text,
            //     votes: 0,
            //     userId: currentUser.uid,
            //     userName: currentUser.displayName || currentUser.email
            // };
            // questions.push(newQuestion); // REMOVE THIS

            db.collection("questions").add({
                text: text,
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email,
                votes: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp() // Add server timestamp
            }).then(() => {
                questionInput.value = ''; // Clear input
                // No need to call renderQuestions() here, onSnapshot will handle it
            }).catch((error) => {
                console.error("Error adding question: ", error);
                alert("Error adding question. Please try again.");
            });
            // questionInput.value = ''; // Old position, moved into .then()
            // renderQuestions(); // Old call, removed
        } else if (!currentUser) {
            alert("Please sign in to add a question.");
        }
    });

    // --- Handle Upvote ---
    function handleUpvote(questionId) { // Modified to accept currentVotes if needed, or fetch
        const questionRef = db.collection("questions").doc(questionId);
        let newVoteCount;

        if (userVotes[questionId]) { // Already voted, so remove vote
            newVoteCount = firebase.firestore.FieldValue.increment(-1);
            userVotes[questionId] = false;
        } else { // Not voted, so add vote
            newVoteCount = firebase.firestore.FieldValue.increment(1);
            userVotes[questionId] = true;
        }

        questionRef.update({ votes: newVoteCount })
            .then(() => {
                // renderQuestions() will be called by onSnapshot,
                // but userVotes change needs to be reflected immediately if render is not fast enough
                // This might require a local re-render of just the button or relying on onSnapshot.
                // For now, let onSnapshot handle the re-render of the vote count.
                // To update the button class immediately:
                const voteButton = document.querySelector(`.question-item[data-id="${questionId}"] .vote-button`);
                if (voteButton) {
                    if (userVotes[questionId]) {
                        voteButton.classList.add('voted');
                    } else {
                        voteButton.classList.remove('voted');
                    }
                    // The vote count text itself will be updated by onSnapshot's call to renderQuestions.
                }
            })
            .catch((error) => {
                console.error("Error updating vote: ", error);
                // Revert local userVotes state if Firestore update fails
                userVotes[questionId] = !userVotes[questionId]; 
            });
    }

    // --- Handle Remove ---
    function handleRemove(questionId) {
        const questionRef = db.collection("questions").doc(questionId);
        // Optional: Add a confirmation dialog before deleting
        // if (confirm("Are you sure you want to remove this question?")) {
            questionRef.get().then((doc) => {
                if (doc.exists && currentUser && doc.data().userId === currentUser.uid) {
                    questionRef.delete()
                        .then(() => {
                            // console.log("Question removed");
                            // No need to call renderQuestions(), onSnapshot will handle it
                            delete userVotes[questionId]; // Clean up local vote tracking
                        })
                        .catch((error) => {
                            console.error("Error removing question: ", error);
                            alert("Error removing question.");
                        });
                } else if (doc.exists && currentUser && doc.data().userId !== currentUser.uid) {
                    // This case should ideally be prevented by security rules & UI
                    alert("You can only remove your own questions.");
                } else if (!doc.exists) {
                    alert("This question no longer exists.");
                } else { // Not signed in
                    alert("You must be signed in to remove questions.");
                }
            }).catch(error => {
                console.error("Error fetching question for deletion: ", error);
                alert("Could not verify question ownership for deletion.");
            });
        // }
    }

    // --- Initial Render ---
    // renderQuestions(); // Called by onAuthStateChanged (via loadQuestionsFromFirestore) initially.
    // Note: Questions are now persisted in Firestore.
});
