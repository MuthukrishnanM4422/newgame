// admin.js
let currentGame = null;
let gameInterval = null;

// Initialize admin interface
async function initAdmin() {
    await sharedStorage.init();
    await loadCurrentGame();
    switchTab('setup');
    startGameMonitoring();
    
    // Show connection status
    updateConnectionStatus('🌐 Connected to Cloud Storage');
    
    // Add sync button
    addSyncButton();
}

// Update connection status
function updateConnectionStatus(message) {
    let statusElement = document.getElementById('connection-status');
    if (!statusElement) {
        const header = document.querySelector('.header');
        statusElement = document.createElement('div');
        statusElement.id = 'connection-status';
        statusElement.style.cssText = 'position: absolute; top: 20px; right: 20px; background: var(--success); color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px;';
        header.style.position = 'relative';
        header.appendChild(statusElement);
    }
    statusElement.textContent = message;
}

// Add sync button to admin interface
function addSyncButton() {
    const navButtons = document.querySelector('.nav-buttons');
    const syncButton = document.createElement('button');
    syncButton.textContent = '🔄 Sync';
    syncButton.onclick = forceSync;
    syncButton.style.background = 'var(--info)';
    syncButton.title = 'Force refresh from cloud';
    navButtons.appendChild(syncButton);
}

// Switch between tabs
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab and activate button
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    // Refresh tab content
    refreshTabContent(tabName);
}

// Refresh content based on active tab
function refreshTabContent(tabName) {
    switch(tabName) {
        case 'setup':
            refreshGameSetup();
            break;
        case 'players':
            refreshPlayersList();
            break;
        case 'control':
            refreshGameControl();
            break;
        case 'results':
            refreshResults();
            break;
    }
}

// Create a new game
async function createNewGame() {
    try {
        const gameName = document.getElementById('game-name').value || 'My Kahoot Game';
        const gamePin = await generateGamePin();
        
        console.log('🎮 Creating new game with PIN:', gamePin);
        
        const newGame = {
            pin: gamePin,
            name: gameName,
            status: 'waiting',
            currentQuestion: 0,
            players: {},
            questions: [],
            createdAt: new Date().toISOString(),
            lastUpdated: Date.now(),
            settings: {
                timeLimit: 20,
                points: {
                    first: 1000,
                    second: 800,
                    third: 600,
                    participation: 500
                }
            }
        };
        
        // Save to shared storage
        const games = await sharedStorage.getGames();
        console.log('📊 Current games before save:', Object.keys(games));
        
        games[gamePin] = newGame;
        const saveResult = await sharedStorage.saveGames(games);
        
        console.log('💾 Save result:', saveResult);
        
        if (saveResult) {
            currentGame = newGame;
            updateGameDisplay();
            
            // Clear the form
            document.getElementById('game-name').value = '';
            
            // Show share info
            showShareInfo(gamePin);
        } else {
            alert('❌ Failed to save game to cloud. Please check your connection.');
        }
    } catch (error) {
        console.error('❌ Error creating game:', error);
        alert('❌ Error creating game: ' + error.message);
    }
}

// Show share information
function showShareInfo(gamePin) {
    const shareMessage = `🎮 Game Created Successfully!

📋 Game PIN: ${gamePin}

🌐 Share this PIN with players on ANY device or browser!

The game is now stored in the cloud and accessible from anywhere.`;
    
    alert(shareMessage);
}

// Generate a 6-digit game PIN
async function generateGamePin() {
    let pin;
    const games = await sharedStorage.getGames();
    
    do {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (games[pin]);
    
    return pin;
}

// Load current game from shared storage
async function loadCurrentGame() {
    try {
        const games = await sharedStorage.getGames();
        console.log('📥 Available games from cloud:', Object.keys(games));
        
        const gamePins = Object.keys(games).filter(pin => games[pin]);
        
        if (gamePins.length > 0) {
            // Load the most recent game
            const latestPin = gamePins.reduce((latest, pin) => {
                return (games[pin].lastUpdated || 0) > (games[latest].lastUpdated || 0) ? pin : latest;
            }, gamePins[0]);
            
            currentGame = games[latestPin];
            console.log('🎯 Loaded current game:', currentGame);
            updateGameDisplay();
            updateConnectionStatus('🌐 Connected - Game Loaded');
        } else {
            console.log('📭 No games found in cloud storage');
            currentGame = null;
            updateGameDisplay();
            updateConnectionStatus('🌐 Connected - No Games');
        }
    } catch (error) {
        console.error('❌ Error loading current game:', error);
        currentGame = null;
        updateGameDisplay();
        updateConnectionStatus('🔴 Connection Error');
    }
}

// Update game display
function updateGameDisplay() {
    const gamePinElement = document.getElementById('current-game-pin');
    const gameInfoElement = document.getElementById('game-info');
    
    if (currentGame) {
        gamePinElement.textContent = currentGame.pin;
        gameInfoElement.innerHTML = `
            <p><strong>Game Name:</strong> ${currentGame.name}</p>
            <p><strong>Status:</strong> <span class="status-${currentGame.status}">${currentGame.status.toUpperCase()}</span></p>
            <p><strong>Players Joined:</strong> ${Object.keys(currentGame.players).length}</p>
            <p><strong>Questions:</strong> ${currentGame.questions.length}</p>
            <p><strong>Last Updated:</strong> ${new Date(currentGame.lastUpdated).toLocaleTimeString()}</p>
            <p><strong>Storage:</strong> 🌐 Cloud Sync</p>
        `;
    } else {
        gamePinElement.textContent = 'No active game';
        gameInfoElement.innerHTML = '<p>Create a new game to get started!</p>';
    }
    
    refreshQuestionsList();
}

// Add a question to the current game
async function addQuestion() {
    if (!currentGame) {
        alert('Please create a game first');
        return;
    }
    
    const questionText = document.getElementById('question-text').value;
    const option1 = document.getElementById('option1').value;
    const option2 = document.getElementById('option2').value;
    const option3 = document.getElementById('option3').value;
    const option4 = document.getElementById('option4').value;
    const correctAnswer = parseInt(document.getElementById('correct-answer').value);
    const timeLimit = parseInt(document.getElementById('time-limit').value) || 20;
    
    if (!questionText || !option1 || !option2 || !option3 || !option4) {
        alert('Please fill in all fields');
        return;
    }
    
    const question = {
        text: questionText,
        options: [option1, option2, option3, option4],
        correctAnswer: correctAnswer,
        timeLimit: timeLimit
    };
    
    currentGame.questions.push(question);
    await saveGame();
    
    // Clear form
    document.getElementById('question-text').value = '';
    document.getElementById('option1').value = '';
    document.getElementById('option2').value = '';
    document.getElementById('option3').value = '';
    document.getElementById('option4').value = '';
    
    refreshQuestionsList();
    alert('✅ Question added successfully!');
}

// Refresh questions list
function refreshQuestionsList() {
    const list = document.getElementById('questions-list');
    
    if (!currentGame || currentGame.questions.length === 0) {
        list.innerHTML = '<p class="no-data">No questions added yet</p>';
        return;
    }
    
    list.innerHTML = currentGame.questions.map((q, index) => `
        <div class="question-item">
            <h4>Question ${index + 1}</h4>
            <p><strong>Q:</strong> ${q.text}</p>
            <p><strong>Options:</strong></p>
            <ol>
                ${q.options.map((opt, optIndex) => `
                    <li>${opt} ${optIndex + 1 === q.correctAnswer ? '✅' : ''}</li>
                `).join('')}
            </ol>
            <p><strong>Time Limit:</strong> ${q.timeLimit} seconds</p>
            <button onclick="deleteQuestion(${index})" class="danger">Delete Question</button>
        </div>
    `).join('');
}

// Delete a question
async function deleteQuestion(index) {
    if (confirm('Are you sure you want to delete this question?')) {
        currentGame.questions.splice(index, 1);
        await saveGame();
        refreshQuestionsList();
    }
}

// Refresh players list
function refreshPlayersList() {
    const list = document.getElementById('players-list');
    
    if (!currentGame || Object.keys(currentGame.players).length === 0) {
        list.innerHTML = '<p class="no-data">No players have joined yet</p>';
        return;
    }
    
    list.innerHTML = Object.values(currentGame.players).map(player => `
        <div class="player-card">
            <h4>${player.name}</h4>
            <p>🎯 Score: ${player.score || 0} points</p>
            <p>🟢 Online</p>
            <p>🕐 Joined: ${new Date(player.joinedAt).toLocaleTimeString()}</p>
            <p>🌐 From Cloud</p>
        </div>
    `).join('');
}

// Start the game
async function startGame() {
    if (!currentGame) {
        alert('Please create a game first');
        return;
    }
    
    if (currentGame.questions.length === 0) {
        alert('Please add at least one question before starting the game');
        return;
    }
    
    if (Object.keys(currentGame.players).length === 0) {
        alert('Wait for at least one player to join before starting the game');
        return;
    }
    
    currentGame.status = 'playing';
    currentGame.currentQuestion = 0;
    currentGame.startedAt = new Date().toISOString();
    
    // Initialize player scores
    Object.keys(currentGame.players).forEach(playerId => {
        currentGame.players[playerId].score = 0;
        currentGame.players[playerId].answers = {};
    });
    
    await saveGame();
    refreshGameControl();
    
    alert('🎮 Game Started!\n\nPlayers can now begin answering questions.');
}

// Move to next question
async function nextQuestion() {
    if (!currentGame || currentGame.status !== 'playing') return;
    
    if (currentGame.currentQuestion < currentGame.questions.length - 1) {
        currentGame.currentQuestion++;
        await saveGame();
        refreshGameControl();
    } else {
        await endGame();
    }
}

// End the game
async function endGame() {
    if (!currentGame) return;
    
    currentGame.status = 'finished';
    currentGame.endedAt = new Date().toISOString();
    
    // Calculate final scores
    calculateFinalScores();
    
    await saveGame();
    refreshGameControl();
    refreshResults();
    
    alert('🏆 Game Ended!\n\nFinal results are now available to all players.');
}

// Calculate final scores
function calculateFinalScores() {
    if (!currentGame) return;
    
    // Sort players by score
    const sortedPlayers = Object.entries(currentGame.players)
        .sort(([,a], [,b]) => (b.score || 0) - (a.score || 0));
    
    // Award bonus points for top positions
    sortedPlayers.forEach(([playerId, player], index) => {
        let bonus = 0;
        if (index === 0) bonus = currentGame.settings.points.first;
        else if (index === 1) bonus = currentGame.settings.points.second;
        else if (index === 2) bonus = currentGame.settings.points.third;
        else bonus = currentGame.settings.points.participation;
        
        player.score = (player.score || 0) + bonus;
        player.position = index + 1;
        player.finalScore = player.score;
    });
}

// Refresh game control interface
function refreshGameControl() {
    const startBtn = document.getElementById('start-btn');
    const nextBtn = document.getElementById('next-btn');
    const endBtn = document.getElementById('end-btn');
    const questionDisplay = document.getElementById('current-question-display');
    
    if (!currentGame) {
        startBtn.classList.remove('hidden');
        nextBtn.classList.add('hidden');
        endBtn.classList.add('hidden');
        questionDisplay.classList.add('hidden');
        return;
    }
    
    switch(currentGame.status) {
        case 'waiting':
            startBtn.classList.remove('hidden');
            nextBtn.classList.add('hidden');
            endBtn.classList.add('hidden');
            questionDisplay.classList.add('hidden');
            break;
            
        case 'playing':
            startBtn.classList.add('hidden');
            nextBtn.classList.remove('hidden');
            endBtn.classList.remove('hidden');
            questionDisplay.classList.remove('hidden');
            showCurrentQuestion();
            break;
            
        case 'finished':
            startBtn.classList.add('hidden');
            nextBtn.classList.add('hidden');
            endBtn.classList.add('hidden');
            questionDisplay.classList.add('hidden');
            break;
    }
}

// Show current question
function showCurrentQuestion() {
    if (!currentGame || currentGame.status !== 'playing') return;
    
    const question = currentGame.questions[currentGame.currentQuestion];
    if (!question) return;
    
    document.getElementById('current-question-text').textContent = question.text;
    document.getElementById('question-timer').textContent = question.timeLimit;
    
    const optionsContainer = document.getElementById('current-options');
    optionsContainer.innerHTML = question.options.map((option, index) => {
        const optionLetter = String.fromCharCode(65 + index);
        const isCorrect = (index + 1) === question.correctAnswer;
        return `
            <div class="option ${isCorrect ? 'correct-answer' : ''}">
                ${optionLetter}. ${option}
                ${isCorrect ? ' ✅' : ''}
            </div>
        `;
    }).join('');
}

// Refresh results
function refreshResults() {
    refreshLeaderboard();
    refreshQuestionResults();
}

// Refresh leaderboard
function refreshLeaderboard() {
    const leaderboard = document.getElementById('live-leaderboard');
    
    if (!currentGame || Object.keys(currentGame.players).length === 0) {
        leaderboard.innerHTML = '<p class="no-data">No players yet</p>';
        return;
    }
    
    // Sort players by score
    const sortedPlayers = Object.entries(currentGame.players)
        .sort(([,a], [,b]) => (b.score || 0) - (a.score || 0));
    
    leaderboard.innerHTML = sortedPlayers.map(([playerId, player], index) => {
        let medal = '';
        if (index === 0) medal = '🥇';
        else if (index === 1) medal = '🥈';
        else if (index === 2) medal = '🥉';
        
        return `
            <div class="leaderboard-item ${index < 3 ? 'top-three' : ''}">
                <div>
                    <span class="position">${medal} ${index + 1}</span>
                    <span>${player.name}</span>
                </div>
                <div>${player.score || 0} pts</div>
            </div>
        `;
    }).join('');
}

// Refresh question results
function refreshQuestionResults() {
    const resultsContainer = document.getElementById('question-results');
    
    if (!currentGame || currentGame.questions.length === 0) {
        resultsContainer.innerHTML = '<p class="no-data">No questions yet</p>';
        return;
    }
    
    resultsContainer.innerHTML = currentGame.questions.map((question, index) => {
        const correctAnswers = Object.values(currentGame.players).filter(player => 
            player.answers && player.answers[index] === question.correctAnswer
        ).length;
        
        const totalPlayers = Object.keys(currentGame.players).length;
        const percentage = totalPlayers > 0 ? Math.round((correctAnswers / totalPlayers) * 100) : 0;
        
        return `
            <div class="question-result">
                <h4>Question ${index + 1}</h4>
                <p>${question.text}</p>
                <p><strong>Correct Answers:</strong> ${correctAnswers}/${totalPlayers} (${percentage}%)</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Monitor game state changes
function startGameMonitoring() {
    sharedStorage.startMonitoring(async (games) => {
        if (currentGame && games[currentGame.pin]) {
            const updatedGame = games[currentGame.pin];
            
            // Only update if the game has actually changed
            if (updatedGame.lastUpdated > (currentGame.lastUpdated || 0)) {
                currentGame = updatedGame;
                updateGameDisplay();
                refreshTabContent(getActiveTab());
                updateConnectionStatus(`🌐 Synced ${new Date().toLocaleTimeString()}`);
            }
        }
    });
}

// Get active tab name
function getActiveTab() {
    const activeTab = document.querySelector('.tab-content.active');
    return activeTab ? activeTab.id : 'setup';
}

// Save current game
async function saveGame() {
    if (!currentGame) return false;
    
    try {
        currentGame.lastUpdated = Date.now();
        const games = await sharedStorage.getGames();
        games[currentGame.pin] = currentGame;
        const result = await sharedStorage.saveGames(games);
        console.log('💾 Game saved to cloud:', result);
        return result;
    } catch (error) {
        console.error('❌ Error saving game:', error);
        return false;
    }
}

// Refresh game setup tab
function refreshGameSetup() {
    updateGameDisplay();
    refreshQuestionsList();
}

// Force sync
async function forceSync() {
    updateConnectionStatus('🔄 Syncing...');
    const games = await sharedStorage.forceSync();
    if (currentGame && games[currentGame.pin]) {
        currentGame = games[currentGame.pin];
        updateGameDisplay();
        refreshTabContent(getActiveTab());
        updateConnectionStatus('🌐 Manual Sync Complete');
        alert('✅ Sync complete! Latest data loaded from cloud.');
    } else {
        updateConnectionStatus('🌐 Sync Complete - No Changes');
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initAdmin);