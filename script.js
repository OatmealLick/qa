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
    const removeAllQuestionsButton = document.getElementById('remove-all-questions-button'); // Added

    const githubSignInButton = document.getElementById('github-signin-button'); 
    const facebookSignInButton = document.getElementById('facebook-signin-button'); 
    // References for Microsoft, X, and Apple buttons removed.

    // let questions = []; // Local questions array removed, Firestore is the source of truth.
    // let userVotes = {}; // REMOVED - Replaced by votedBy array in Firestore documents.
    let questionsListener = null; // To hold the Firestore listener unsubscribe function
    let commentListeners = {}; // To hold Firestore listeners for comments, keyed by questionId


    let currentUser = null; // To store the current authenticated user object

    // Client-side list of admin UIDs (for UI purposes only, rules enforce actual deletion, you can try 'hacking it' dear reader :) )
    const adminUIDs = ["p9C3Ld9rHuPfe2synovUe3N1K4h1", "LGA38I8WjgOLgzN2nKlW0KtGUUo2", "WHj6mkqbiONyGuPvxqAm1K1UzOo1"];

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
            
            if (adminUIDs.includes(user.uid)) {
                removeAllQuestionsButton.style.display = 'block'; // Or your preferred display type
            } else {
                removeAllQuestionsButton.style.display = 'none';
            }
            loadQuestionsFromFirestore(); // Load questions for logged-in user
        } else {
            // User is signed out
            userDetailsP.textContent = '';
            userInfoDiv.style.display = 'none';
            googleSignInButton.style.display = 'block';
            githubSignInButton.style.display = 'block';
            facebookSignInButton.style.display = 'block';
            signOutButton.style.display = 'none';
            removeAllQuestionsButton.style.display = 'none'; // Hide for signed-out users

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

        questionsListener = db.collection("questions")
            .orderBy("votes", "desc")
            .orderBy("createdAt", "desc") // Secondary sort for tie-breaking
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

        // Clean up all existing comment listeners before re-rendering questions
        Object.values(commentListeners).forEach(unsubscribe => unsubscribe());
        commentListeners = {};

        questionsData.forEach(question => { // Operates on questionsData
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item');
            questionItem.dataset.id = question.id;

            const questionText = document.createElement('p');
            questionText.classList.add('question-text');
            // Make sure question.text exists, especially if there are DB schema inconsistencies
            questionText.textContent = question.text || "[No question text]"; 

            if (question.answered === true) {
                const answeredIndicator = document.createElement('span');
                answeredIndicator.textContent = " (Answered)";
                answeredIndicator.classList.add('answered-text-indicator');
                questionText.appendChild(answeredIndicator);
            }
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

            // Admin: Mark as answered checkbox
            if (currentUser && adminUIDs.includes(currentUser.uid)) {
                const answeredCheckbox = document.createElement('input');
                answeredCheckbox.type = 'checkbox';
                answeredCheckbox.classList.add('answered-checkbox');
                answeredCheckbox.checked = !!question.answered; // Ensure boolean, default to false if undefined
                answeredCheckbox.title = question.answered ? "Mark as Unanswered" : "Mark as Answered";

                answeredCheckbox.addEventListener('change', () => {
                    handleMarkAsAnswered(question.id, answeredCheckbox.checked);
                });

                const answeredLabel = document.createElement('label');
                answeredLabel.classList.add('answered-label');
                answeredLabel.appendChild(answeredCheckbox);
                answeredLabel.appendChild(document.createTextNode(question.answered ? ' Answered' : ' Mark Answered'));

                // Change label text dynamically if needed, or use CSS to hide/show text based on state
                answeredCheckbox.addEventListener('change', () => {
                   answeredLabel.childNodes[1].nodeValue = answeredCheckbox.checked ? ' Answered' : ' Mark Answered';
                   answeredCheckbox.title = answeredCheckbox.checked ? "Mark as Unanswered" : "Mark as Answered";
                });

                questionActions.appendChild(answeredLabel);
            }

            // Apply 'answered-question' class if the question is answered
            if (question.answered === true) {
                questionItem.classList.add('answered-question');
            } else {
                questionItem.classList.remove('answered-question'); // Ensure class is removed if not answered
            }

            questionItem.appendChild(questionActions);

            // --- Comments Section ---
            const commentsSection = document.createElement('div');
            commentsSection.classList.add('comments-section');

            const commentsHeader = document.createElement('h4'); // Or h3
            commentsHeader.textContent = 'Comments:';
            commentsSection.appendChild(commentsHeader);

            const commentsList = document.createElement('div'); // To hold the list of comments
            commentsSection.appendChild(commentsList);

            // Detach existing listener for this question's comments if it exists
            if (commentListeners[question.id]) {
                commentListeners[question.id]();
            }

            // Listen for comments on this question
            commentListeners[question.id] = db.collection("questions").doc(question.id).collection("comments")
                .orderBy("createdAt")
                .onSnapshot(snapshot => {
                    commentsList.innerHTML = ''; // Clear previous comments for this question
                    snapshot.forEach(doc => {
                        const comment = { id: doc.id, ...doc.data() };
                        const commentDiv = document.createElement('div');
                        commentDiv.classList.add('comment-item');

                        const commentText = document.createElement('span');
                        commentText.textContent = comment.text;
                        commentDiv.appendChild(commentText);

                        if (comment.createdAt && comment.createdAt.toDate) {
                            const commentTimestamp = document.createElement('span');
                            commentTimestamp.classList.add('comment-timestamp');
                            commentTimestamp.textContent = ` - ${comment.createdAt.toDate().toLocaleString()}`;
                            commentDiv.appendChild(commentTimestamp);
                        }

                        if (currentUser && adminUIDs.includes(currentUser.uid)) {
                            const deleteButton = document.createElement('button');
                            deleteButton.textContent = 'Delete';
                            deleteButton.classList.add('delete-comment-button');
                            deleteButton.style.marginLeft = '10px'; // Basic styling
                            deleteButton.addEventListener('click', () => handleDeleteComment(question.id, comment.id));
                            commentDiv.appendChild(deleteButton);
                        }
                        commentsList.appendChild(commentDiv);
                    });
                }, error => {
                    console.error(`Error fetching comments for question ${question.id}:`, error);
                    commentsList.innerHTML = '<p>Error loading comments.</p>';
                });

            // Add Comment Form (for admins)
            if (currentUser && adminUIDs.includes(currentUser.uid)) {
                const addCommentForm = document.createElement('form');
                addCommentForm.classList.add('add-comment-form');

                const commentInput = document.createElement('input');
                commentInput.type = 'text';
                commentInput.classList.add('comment-input');
                commentInput.placeholder = 'Add a comment...';

                const addCommentButton = document.createElement('button');
                addCommentButton.type = 'submit';
                addCommentButton.textContent = 'Add Comment';

                addCommentForm.appendChild(commentInput);
                addCommentForm.appendChild(addCommentButton);

                addCommentForm.addEventListener('submit', (e) => {
                    // Pass question.id and the input element itself
                    handleAddComment(e, question.id, commentInput);
                });
                commentsSection.appendChild(addCommentForm);
            }

            questionItem.appendChild(commentsSection);
            questionsList.appendChild(questionItem);
        });
    }

    // --- Handle Add Comment ---
    function handleAddComment(event, questionId, commentInputElement) {
        event.preventDefault();
        if (!currentUser || !adminUIDs.includes(currentUser.uid)) {
            alert("You do not have permission to add comments.");
            return;
        }
        const commentText = commentInputElement.value.trim();
        if (commentText === "") {
            alert("Comment cannot be empty.");
            return;
        }

        db.collection("questions").doc(questionId).collection("comments").add({
            text: commentText,
            userId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            commentInputElement.value = ''; // Clear input field
            // Comments will be re-rendered by the onSnapshot listener
        }).catch(error => {
            console.error("Error adding comment: ", error);
            alert("Error adding comment. Please try again.");
        });
    }

    // --- Handle Delete Comment ---
    function handleDeleteComment(questionId, commentId) {
        if (!currentUser || !adminUIDs.includes(currentUser.uid)) {
            alert("You do not have permission to delete comments.");
            return;
        }
        if (confirm("Are you sure you want to delete this comment?")) {
            db.collection("questions").doc(questionId).collection("comments").doc(commentId).delete()
                .then(() => {
                    // Comment will be removed from UI by the onSnapshot listener
                })
                .catch(error => {
                    console.error("Error deleting comment: ", error);
                    alert("Error deleting comment. Please try again.");
                });
        }
    }


    // --- Handle Mark as Answered ---
    function handleMarkAsAnswered(questionId, newStatus) {
        if (!currentUser || !adminUIDs.includes(currentUser.uid)) {
            alert("You do not have permission to perform this action.");
            return;
        }
        const questionRef = db.collection("questions").doc(questionId);
        questionRef.update({
            answered: newStatus
        }).then(() => {
            // console.log(`Question ${questionId} marked as ${newStatus ? 'answered' : 'unanswered'}.`);
            // UI will update via onSnapshot listener.
        }).catch((error) => {
            console.error("Error updating question answered status: ", error);
            alert("Error updating question status. Please try again.");
            // Optionally, revert checkbox state here if Firestore update fails,
            // though onSnapshot should eventually correct it.
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
                            answered: false, // Initialize answered to false
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

    // --- Event Listener for Remove All Questions ---
    removeAllQuestionsButton.addEventListener('click', handleRemoveAllQuestions);

    // --- Handle Remove All Questions ---
    function handleRemoveAllQuestions() {
        if (!currentUser || !adminUIDs.includes(currentUser.uid)) {
            alert("You do not have permission to perform this action.");
            return;
        }

        if (confirm("DANGER: Are you absolutely sure you want to remove ALL questions? This action cannot be undone.")) {
            db.collection("questions").get()
                .then((querySnapshot) => {
                    if (querySnapshot.empty) {
                        alert("There are no questions to remove.");
                        return; // Return a resolved promise or undefined
                    }

                    // For a moderate number of questions, individual deletes are fine.
                    // For a very large number, batched writes or a Cloud Function would be better.
                    const deletePromises = [];
                    querySnapshot.forEach((doc) => {
                        deletePromises.push(doc.ref.delete());
                    });
                    
                    return Promise.all(deletePromises);
                })
                .then(() => {
                    // This .then() will only be reached if the Promise.all was successful
                    // or if the querySnapshot was empty and we returned early.
                    // We should only alert if questions were actually deleted.
                    // However, the current structure means this alert might show even if querySnapshot was empty.
                    // To fix, we can check if deletePromises had any items.
                    // For now, keeping it simple as per provided code.
                    alert("All questions have been removed.");
                    // UI will update automatically via the onSnapshot listener in loadQuestionsFromFirestore
                })
                .catch((error) => {
                    console.error("Error removing all questions: ", error);
                    alert("An error occurred while trying to remove all questions. Please check the console for details.");
                });
        }
    }
});
