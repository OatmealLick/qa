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

    let questions = []; // Array to store question objects { id: 'uuid', text: '...', votes: 0, userId?: '...', userName?: '...' }
    let userVotes = {}; // Object to track user votes { questionId: true/false }

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
            renderQuestions(); // Render questions now that user is logged in
        } else {
            // User is signed out
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

    // --- Render Questions ---
    function renderQuestions() {
        questionsList.innerHTML = ''; // Clear existing questions

        questions.forEach(question => {
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item');
            questionItem.dataset.id = question.id;

            const questionText = document.createElement('p');
            questionText.classList.add('question-text');
            questionText.textContent = question.text;
            // Author name display removed as per requirement


            const questionActions = document.createElement('div');
            questionActions.classList.add('question-actions');

            const voteButton = document.createElement('button');
            voteButton.classList.add('vote-button');
            voteButton.textContent = `Upvote (${question.votes})`;
            if (userVotes[question.id]) {
                voteButton.classList.add('voted');
            }
            voteButton.addEventListener('click', () => handleUpvote(question.id));

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
            const newQuestion = {
                id: crypto.randomUUID(),
                text: text,
                votes: 0,
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email // Store display name or email
            };
            questions.push(newQuestion);
            questionInput.value = '';
            renderQuestions();
        } else if (!currentUser) {
            alert("Please sign in to add a question.");
        }
    });

    // --- Handle Upvote ---
    function handleUpvote(questionId) {
        const question = questions.find(q => q.id === questionId);
        if (question) {
            // For now, allow anyone to vote, even if not logged in or not their question
            // This could be restricted further if needed (e.g., only logged-in users can vote)
            if (userVotes[questionId]) {
                question.votes--;
                userVotes[questionId] = false;
            } else {
                question.votes++;
                userVotes[questionId] = true;
            }
            renderQuestions();
        }
    }

    // --- Handle Remove ---
    function handleRemove(questionId) {
        const questionToRemove = questions.find(q => q.id === questionId);
        // Double check ownership before removing, though button visibility should also handle this
        if (currentUser && questionToRemove && questionToRemove.userId === currentUser.uid) {
            questions = questions.filter(q => q.id !== questionId);
            delete userVotes[questionId];
            renderQuestions();
        } else {
            alert("You can only remove your own questions.");
        }
    }

    // --- Initial Render ---
    // renderQuestions(); // Called by onAuthStateChanged initially
    // Note: Questions are client-side only and will be lost on page refresh.
    // For persistent storage, a database like Firebase Firestore or Realtime Database would be needed.
});
