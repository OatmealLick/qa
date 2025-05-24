document.addEventListener('DOMContentLoaded', () => {
    const questionForm = document.getElementById('add-question-form');
    const questionInput = document.getElementById('question-input');
    const questionsList = document.getElementById('questions-list');

    let questions = []; // Array to store question objects { id: 'uuid', text: '...', votes: 0 }
    let userVotes = {}; // Object to track user votes { questionId: true/false } (simple toggle)

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

            const questionActions = document.createElement('div');
            questionActions.classList.add('question-actions');

            const voteButton = document.createElement('button');
            voteButton.classList.add('vote-button');
            voteButton.textContent = `Upvote (${question.votes})`;
            if (userVotes[question.id]) {
                voteButton.classList.add('voted'); // Add 'voted' class if user has voted
            }
            voteButton.addEventListener('click', () => handleUpvote(question.id));

            const removeButton = document.createElement('button');
            removeButton.classList.add('remove-button');
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => handleRemove(question.id));

            questionActions.appendChild(voteButton);
            // questionActions.appendChild(voteCountSpan); // Vote count is in button text for now
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
        if (text) {
            const newQuestion = {
                id: crypto.randomUUID(),
                text: text,
                votes: 0
            };
            questions.push(newQuestion);
            questionInput.value = ''; // Clear input
            renderQuestions();
        }
    });

    // --- Handle Upvote ---
    function handleUpvote(questionId) {
        const question = questions.find(q => q.id === questionId);
        if (question) {
            if (userVotes[questionId]) { // Already voted, so remove vote
                question.votes--;
                userVotes[questionId] = false;
            } else { // Not voted, so add vote
                question.votes++;
                userVotes[questionId] = true;
            }
            renderQuestions();
        }
    }

    // --- Handle Remove ---
    function handleRemove(questionId) {
        questions = questions.filter(q => q.id !== questionId);
        delete userVotes[questionId]; // Remove vote tracking for this question
        renderQuestions();
    }

    // --- Initial Render ---
    renderQuestions();
});
