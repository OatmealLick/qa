document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    // IMPORTANT: Replace with your app's Firebase project configuration object!
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
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
    // let userVotes = {}; // REMOVED - Replaced by votedBy array in Firestore documents.
    let questionsListener = null; // To hold the Firestore listener unsubscribe function

    let currentUser = null; // To store the current authenticated user object

    // Client-side list of admin UIDs (for UI purposes only, rules enforce actual deletion)
    // IMPORTANT: Replace with the same UIDs used in your Firestore Security Rules
    const adminUIDs = ["ADMIN_UID_1_PLACEHOLDER", "ADMIN_UID_2_PLACEHOLDER"]; 

    // --- Auth State Observer ---
    auth.onAuthStateChanged(user => {
        currentUser = user; // This should be at the top of the function

        if (questionsListener) { // Detach any existing listener first
            questionsListener();
            questionsListener = null;
        }

        if (user) {
            // User is signed in
            userDetailsP.textContent = `Logged in as: ${user.displayName || user.email}`;
            userInfoDiv.style.display = 'block';
            googleSignInButton.style.display = 'none';
            githubSignInButton.style.display = 'none';
            facebookSignInButton.style.display = 'none';
            signOutButton.style.display = 'block';

            questionInput.disabled = false;
            addQuestionButton.disabled = false;
            
            loadQuestionsFromFirestore(); // Load questions for logged-in user
        } else {
            // User is signed out
            userDetailsP.textContent = '';
            userInfoDiv.style.display = 'none';
            googleSignInButton.style.display = 'block';
            githubSignInButton.style.display = 'block';
            facebookSignInButton.style.display = 'block';
            signOutButton.style.display = 'none';

            questionInput.disabled = true;
            addQuestionButton.disabled = true;
            // questionsList.innerHTML = ''; // Clearing here might cause flicker if load is fast
            // questionsList.style.display = ''; // Ensure list is visible for logged-out users too
                                          
            loadQuestionsFromFirestore(); // Also load questions for logged-out user
        }
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
        questionsList.style.display = ''; // Or 'block', 'flex' - Make sure list is visible

        // Detach any existing listener by calling the variable that holds the unsubscribe function
        // This is now handled in onAuthStateChanged before calling this function.
        // if (questionsListener) {
        //     questionsListener();
        // }
        // The check for currentUser is also implicitly handled by onAuthStateChanged
        // which now calls this function in both logged-in and logged-out states.
        // UI differences for logged-out (e.g., vote buttons) are handled in renderQuestions.

        questionsListener = db.collection("questions").orderBy("createdAt", "desc")
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

            if (currentUser) {
                const voteButton = document.createElement('button');
                voteButton.classList.add('vote-button');
                voteButton.textContent = `Upvote (${question.votes || 0})`;

                if (question.votedBy && question.votedBy.includes(currentUser.uid)) {
                    voteButton.classList.add('voted');
                } else {
                    voteButton.classList.remove('voted');
                }
                voteButton.addEventListener('click', () => handleUpvote(question.id));
                questionActions.appendChild(voteButton);
            } else {
                const signInToVoteMsg = document.createElement('span');
                signInToVoteMsg.classList.add('signin-to-vote-message');
                signInToVoteMsg.textContent = 'Sign in to upvote!';
                questionActions.appendChild(signInToVoteMsg);
            }
            
            // Logic for the remove button
            if (currentUser) { // User must be logged in to see any remove button
                const isOwner = currentUser.uid === question.userId;
                const isAdminUser = adminUIDs.includes(currentUser.uid);

                if (isOwner || isAdminUser) {
                    const removeButton = document.createElement('button');
                    removeButton.classList.add('remove-button');
                    removeButton.textContent = 'Remove';
                    // removeButton.style.display = 'inline-block'; // No longer needed, only appended if shown
                    removeButton.addEventListener('click', () => handleRemove(question.id));
                    questionActions.appendChild(removeButton);
                }
            }
            // If not current user or not owner/admin, remove button is simply not added.

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
            
            // Check question count before adding
            db.collection("questions").where("userId", "==", currentUser.uid).get()
                .then((querySnapshot) => {
                    const questionCount = querySnapshot.size;
                    if (questionCount >= 20) {
                        alert("You have reached the limit of 20 questions per user.");
                    } else {
                        // Proceed to add the question to Firestore
                        db.collection("questions").add({
                            text: text,
                            userId: currentUser.uid,
                            // 'userName' was removed in a previous update
                            votes: 0,
                            votedBy: [], 
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        }).then(() => {
                            questionInput.value = ''; 
                        }).catch((error) => {
                            console.error("Error adding question: ", error);
                            alert("Error adding question. Please try again.");
                        });
                    }
                })
                .catch((error) => {
                    console.error("Error checking question count: ", error);
                    alert("Could not check your question count. Please try again.");
                });

        } else if (!currentUser) {
            alert("Please sign in to add a question.");
        }
    });

    // --- Handle Upvote ---
    function handleUpvote(questionId) {
        if (!currentUser) {
            alert("Please sign in to vote.");
            return;
        }
        const questionRef = db.collection("questions").doc(questionId);

        db.runTransaction((transaction) => {
            return transaction.get(questionRef).then((questionDoc) => {
                if (!questionDoc.exists) {
                    throw "Document does not exist!";
                }

                const questionData = questionDoc.data();
                const currentVotes = questionData.votes || 0;
                const votedByArray = questionData.votedBy || [];
                let newVotes;
                let newVotedByArray;

                if (votedByArray.includes(currentUser.uid)) {
                    // User has already voted, so unvote
                    newVotes = currentVotes - 1;
                    newVotedByArray = votedByArray.filter(uid => uid !== currentUser.uid);
                } else {
                    // User has not voted, so vote
                    newVotes = currentVotes + 1;
                    newVotedByArray = [...votedByArray, currentUser.uid];
                }
                
                // Ensure votes don't go below zero, though rules should also prevent this
                if (newVotes < 0) newVotes = 0;

                transaction.update(questionRef, { 
                    votes: newVotes, 
                    votedBy: newVotedByArray 
                });
            });
        }).then(() => {
            // console.log("Vote transaction successfully committed!");
            // UI will update via the onSnapshot listener. No need to call renderQuestions() here.
        }).catch((error) => {
            console.error("Vote transaction failed: ", error);
        // The alert was: "There was an error processing your vote. Please try again."
        // Keep it or make it more specific if possible, though Firestore errors can be generic.
        alert("There was an error processing your vote. Please try again. This could be due to a temporary network issue or a problem with the data sync.");
        });
    }

    // --- Handle Remove ---
    function handleRemove(questionId) {
        const questionRef = db.collection("questions").doc(questionId);
        // Optional: Add a confirmation dialog before deleting
        // if (confirm("Are you sure you want to remove this question?")) {
            questionRef.get().then((doc) => {
                if (doc.exists && currentUser) {
                    const isOwner = doc.data().userId === currentUser.uid;
                    const isAdminUser = adminUIDs.includes(currentUser.uid);

                    if (isOwner || isAdminUser) {
                        // Now, if the user is owner OR admin, proceed to delete
                        questionRef.delete()
                            .then(() => {
                                // console.log("Question removed by owner or admin");
                                // No need to call renderQuestions(), onSnapshot will handle it
                            })
                            .catch((error) => {
                                console.error("Error removing question: ", error);
                                alert("Error removing question. Firestore security rules might have prevented it if not owner/admin.");
                            });
                    } else { 
                        // User is logged in but not owner and not admin
                        alert("You do not have permission to remove this question.");
                    }
                } else if (!doc.exists) {
                    alert("Cannot remove: Question does not exist.");
                } else { // User not logged in (though button shouldn't be visible due to renderQuestions logic)
                    alert("Cannot remove: You are not signed in.");
                }
            }).catch(error => {
                console.error("Error fetching question for deletion check: ", error);
                alert("Could not verify question ownership for deletion.");
            });
        // }
    }

    // --- Initial Render ---
    // renderQuestions(); // Called by onAuthStateChanged (via loadQuestionsFromFirestore) initially.
    // Note: Questions are now persisted in Firestore.
});
