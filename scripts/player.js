// player.js
let playerId = null;
let currentGamePin = null;
let playerInterval = null;
let answerSubmitted = false;

// Handle URL parameters for direct joining
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const pin = urlParams.get('pin');
    const name = urlParams.get('name');
    
    if (pin) {
        document.getElementById('game-pin').value = pin;
        
        if (name) {
            document.getElementById('player-name').value = decodeURIComponent(name);
            // Auto-join if both PIN and name are provided
            setTimeout(() => {
                if (confirm(`Auto-join game ${pin} as ${decodeURIComponent(name)}?`)) {
                    joinGame();
                }
            }, 1000);
        } else {
            document.getElementById('player-name').focus();
        }
    }
}

// Join a game
async function joinGame() {
    const gamePin = document.getElementById('game-pin').value.trim();
    const playerName = document.getElementById('player-name').value.trim();
    
    console.log('🎯 Attempting to join game with PIN:', gamePin, 'and name:', playerName);
    
    if (!gamePin || !playerName) {
        alert('Please enter both game PIN and your name');
        return;
    }
    
    if (playerName.length < 2) {
        alert('Please enter a name with at least 2 characters');
        return;
    }
    
    // Initialize shared storage
    await sharedStorage.init();
    
    // Get all games from cloud
    const games = await sharedStorage.getGames();
    console.log('📥 Available games from cloud:', Object.keys(games));
    
    // Check if game exists
    if (!games[gamePin]) {
        const availablePins = Object.keys(games).filter(pin => games[pin]).join(', ');
        alert(`❌ Invalid game PIN: ${gamePin}\n\nAvailable PINs: ${availablePins || 'None'}\n\n🌐 Please check with the game admin.`);
        return;
    }
    
    const game = games[gamePin];
    
    // Check if game is finished
    if (game.status === 'finished') {
        alert('🎮 This game has already ended.\n\nPlease ask the admin to create a new game.');
        return;
    }
    
    // Check if player name already exists
    const existingPlayer = Object.values(game.players).find(p => p.name.toLowerCase() === playerName.toLowerCase());
    if (existingPlayer) {
        alert('❌ This name is already taken in this game.\n\nPlease choose a different name.');
        return;
    }
    
    // Generate player ID
    playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    currentGamePin = gamePin;
    
    // Add player to game
    game.players[playerId] = {
        name: playerName,
        score: 0,
        connected: true,
        joinedAt: new Date().toISOString(),
        answers: {},
        lastActive: new Date().toISOString(),
        device: 'Player',
        fromCloud: true
    };
    
    // Save back to cloud storage
    game.lastUpdated = Date.now();
    games[gamePin] = game;
    await sharedStorage.saveGames(games);
    
    console.log('✅ Successfully joined game:', gamePin);
    
    // Show waiting screen
    showScreen('waiting-screen');
    document.getElementById('player-display-name').textContent = playerName;
    document.getElementById('display-game-pin').textContent = gamePin;
    
    // Update connection status
    updateConnectionStatus('🌐 Connected to Cloud Game');
    
    // Start monitoring
    startGameMonitoring();
    updateLobbyPlayers();
}

// Show specific screen
function showScreen(screenId) {
    document.getElementById('join-screen').classList.add('hidden');
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('results-screen').classList.add('hidden');
    document.getElementById('live-leaderboard-panel').classList.add('hidden');
    
    document.getElementById(screenId).classList.remove('hidden');
    
    if (screenId === 'game-screen' || screenId === 'results-screen') {
        document.getElementById('live-leaderboard-panel').classList.remove('hidden');
    }
}

// Update connection status
function updateConnectionStatus(message) {
    let statusElement = document.getElementById('player-connection-status');
    if (!statusElement) {
        const header = document.querySelector('.header');
        statusElement = document.createElement('div');
        statusElement.id = 'player-connection-status';
        statusElement.style.cssText = 'position: absolute; top: 20px; right: 20px; background: var(--success); color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px;';
        if (header) {
            header.style.position = 'relative';
            header.appendChild(statusElement);
        }
    }
    statusElement.textContent = message;
}

// Update lobby players list
async function updateLobbyPlayers() {
    const game = await getCurrentGame();
    if (!game) return;
    
    const playersList = document.getElementById('lobby-players');
    const playerCount = Object.keys(game.players).length;
    
    playersList.innerHTML = `
        <div class="player-count">Players in Lobby: ${playerCount}</div>
        ${Object.values(game.players).map(player => `
            <div class="player-card">
                <strong>${player.name}</strong>
                <div class="player-status">🟢 Ready</div>
                <div class="player-status">🌐 Cloud</div>
            </div>
        `).join('')}
    `;
}

// Start monitoring game state
function startGameMonitoring() {
    sharedStorage.startMonitoring(async (games) => {
        const game = await getCurrentGame();
        if (!game) {
            // Game might have been deleted
            alert('❌ Game no longer exists or was reset by admin');
            await leaveGame();
            return;
        }
        
        updateGameState(game);
        updateConnectionStatus(`🌐 Synced ${new Date().toLocaleTimeString()}`);
    });
}

// Update game state based on current game status
function updateGameState(game) {
    if (!game) return;
    
    try {
        switch(game.status) {
            case 'waiting':
                updateLobbyPlayers();
                break;
                
            case 'playing':
                showScreen('game-screen');
                showCurrentQuestion(game);
                updateLeaderboard();
                break;
                
            case 'finished':
                showScreen('results-screen');
                showFinalResults(game);
                sharedStorage.stopMonitoring();
                updateConnectionStatus('🏆 Game Ended');
                break;
        }
    } catch (error) {
        console.error('❌ Error updating game state:', error);
    }
}

// Show current question
function showCurrentQuestion(game) {
    const question = game.questions[game.currentQuestion];
    if (!question) return;
    
    // Reset answer state for new question
    if (game.currentQuestion !== (window.lastQuestionIndex || -1)) {
        answerSubmitted = false;
        window.lastQuestionIndex = game.currentQuestion;
    }
    
    document.getElementById('q-number').textContent = game.currentQuestion + 1;
    document.getElementById('game-question-text').textContent = question.text;
    document.getElementById('game-timer').textContent = question.timeLimit;
    
    // Create options
    const optionsContainer = document.getElementById('game-options');
    optionsContainer.innerHTML = question.options.map((option, index) => {
        const optionLetter = String.fromCharCode(65 + index);
        const isCorrect = (index + 1) === question.correctAnswer;
        
        return `
            <div class="option" onclick="selectAnswer(${index + 1})" data-option="${index + 1}">
                <span class="option-letter">${optionLetter}</span>
                <span class="option-text">${option}</span>
            </div>
        `;
    }).join('');
    
    // Reset feedback and enable options if no answer submitted
    document.getElementById('answer-feedback').classList.add('hidden');
    if (!answerSubmitted) {
        document.querySelectorAll('.option').forEach(option => {
            option.style.pointerEvents = 'auto';
            option.classList.remove('selected', 'correct', 'incorrect');
        });
    }
}

// Select an answer
async function selectAnswer(answerIndex) {
    if (answerSubmitted) return;
    
    const game = await getCurrentGame();
    if (!game || game.status !== 'playing') return;
    
    // Mark answer as submitted
    answerSubmitted = true;
    
    // Record answer
    game.players[playerId].answers = game.players[playerId].answers || {};
    game.players[playerId].answers[game.currentQuestion] = answerIndex;
    
    // Calculate time taken (simplified)
    const timeTaken = Math.max(1, 20 - parseInt(document.getElementById('game-timer').textContent));
    
    // Update score if correct
    const question = game.questions[game.currentQuestion];
    let pointsEarned = 0;
    let isCorrect = false;
    
    if (answerIndex === question.correctAnswer) {
        pointsEarned = calculatePoints(timeTaken, question.timeLimit);
        game.players[playerId].score = (game.players[playerId].score || 0) + pointsEarned;
        isCorrect = true;
    }
    
    // Update last activity
    game.players[playerId].lastActive = new Date().toISOString();
    game.lastUpdated = Date.now();
    
    // Save game to cloud
    const games = await sharedStorage.getGames();
    games[currentGamePin] = game;
    await sharedStorage.saveGames(games);
    
    // Show visual feedback
    showAnswerFeedback(isCorrect, pointsEarned, answerIndex, question.correctAnswer);
    
    // Disable further answers
    document.querySelectorAll('.option').forEach(option => {
        option.style.pointerEvents = 'none';
    });
}

// Calculate points based on time taken
function calculatePoints(timeTaken, timeLimit) {
    // Faster answers get more points (1000 base + time bonus)
    const basePoints = 1000;
    const timeBonus = Math.max(1, Math.floor((timeLimit - timeTaken) * 50)); // 50 points per second saved
    return basePoints + timeBonus;
}

// Show answer feedback
function showAnswerFeedback(isCorrect, points, selectedAnswer, correctAnswer) {
    const feedback = document.getElementById('answer-feedback');
    
    // Highlight selected option
    document.querySelectorAll('.option').forEach(option => {
        const optionIndex = parseInt(option.getAttribute('data-option'));
        option.classList.remove('selected', 'correct', 'incorrect');
        
        if (optionIndex === selectedAnswer) {
            option.classList.add(isCorrect ? 'correct' : 'incorrect');
        }
        if (optionIndex === correctAnswer && !isCorrect) {
            option.classList.add('correct');
        }
    });
    
    feedback.classList.remove('hidden');
    
    if (isCorrect) {
        feedback.innerHTML = `
            <div class="feedback-correct">
                <h3>✅ Correct Answer!</h3>
                <p>You earned <strong>${points} points!</strong></p>
                <p>Great job! 🎉</p>
            </div>
        `;
    } else {
        feedback.innerHTML = `
            <div class="feedback-incorrect">
                <h3>❌ Incorrect Answer</h3>
                <p>Better luck on the next question!</p>
                <p>The correct answer was highlighted.</p>
            </div>
        `;
    }
}

// Update leaderboard
async function updateLeaderboard() {
    const game = await getCurrentGame();
    if (!game) return;
    
    const leaderboard = document.getElementById('mini-leaderboard');
    
    // Sort players by score
    const sortedPlayers = Object.entries(game.players)
        .sort(([,a], [,b]) => (b.score || 0) - (a.score || 0))
        .slice(0, 5); // Show top 5
    
    leaderboard.innerHTML = sortedPlayers.map(([id, player], index) => {
        let medal = '';
        if (index === 0) medal = '🥇';
        else if (index === 1) medal = '🥈';
        else if (index === 2) medal = '🥉';
        
        return `
            <div class="leaderboard-item ${id === playerId ? 'you' : ''}">
                <div>
                    <span class="position">${medal} ${index + 1}</span>
                    <span>${player.name}</span>
                </div>
                <div>${player.score || 0}</div>
            </div>
        `;
    }).join('');
}

// Show final results
async function showFinalResults(game) {
    const finalScore = game.players[playerId]?.score || 0;
    document.getElementById('final-score').textContent = finalScore;
    
    // Sort players by score
    const sortedPlayers = Object.entries(game.players)
        .sort(([,a], [,b]) => (b.score || 0) - (a.score || 0));
    
    const leaderboard = document.getElementById('final-leaderboard');
    leaderboard.innerHTML = sortedPlayers.map(([id, player], index) => {
        let medal = '';
        if (index === 0) medal = '🥇';
        else if (index === 1) medal = '🥈';
        else if (index === 2) medal = '🥉';
        
        return `
            <div class="leaderboard-item ${id === playerId ? 'you' : ''}">
                <div>
                    <span class="position">${medal} ${index + 1}</span>
                    <span>${player.name}</span>
                </div>
                <div>${player.score || 0} pts</div>
            </div>
        `;
    }).join('');
    
    // Show achievement message
    const playerPosition = sortedPlayers.findIndex(([id]) => id === playerId) + 1;
    let achievement = '';
    if (playerPosition === 1) achievement = '🏆 CHAMPION! Amazing performance!';
    else if (playerPosition <= 3) achievement = '🎯 Top 3! Excellent work!';
    else if (playerPosition <= 5) achievement = '⭐ Great job!';
    else achievement = '👍 Well played!';
    
    document.querySelector('.player-final-score').innerHTML += `
        <div class="achievement-message">
            <p>${achievement}</p>
            <p>You finished in position ${playerPosition} out of ${sortedPlayers.length} players!</p>
        </div>
    `;
}

// Leave the game
async function leaveGame() {
    sharedStorage.stopMonitoring();
    
    // Remove player from game
    if (currentGamePin && playerId) {
        const games = await sharedStorage.getGames();
        const game = games[currentGamePin];
        if (game && game.players[playerId]) {
            delete game.players[playerId];
            game.lastUpdated = Date.now();
            await sharedStorage.saveGames(games);
        }
    }
    
    // Reset state
    playerId = null;
    currentGamePin = null;
    answerSubmitted = false;
    window.lastQuestionIndex = -1;
    
    // Show join screen
    showScreen('join-screen');
    
    // Clear form
    document.getElementById('game-pin').value = '';
    document.getElementById('player-name').value = '';
}

// Play again (rejoin)
function playAgain() {
    leaveGame();
}

// Get current game
async function getCurrentGame() {
    if (!currentGamePin) return null;
    
    const games = await sharedStorage.getGames();
    const game = games[currentGamePin];
    
    if (!game) {
        console.error('❌ Game not found for PIN:', currentGamePin);
        // Show error to user
        alert('❌ Game session not found.\n\nIt may have been reset by the admin.');
        await leaveGame();
        return null;
    }
    
    return game;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize shared storage
    await sharedStorage.init();
    updateConnectionStatus('🌐 Ready to Join Cloud Game');
    
    // Handle URL parameters for direct joining
    handleUrlParameters();
    
    // Add auto-focus to name field if not already filled
    if (!document.getElementById('player-name').value) {
        document.getElementById('player-name').focus();
    }
});