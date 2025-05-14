const gameVersion = "20250514.1"; // ゲームのバージョン

// script.js

const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas'); // 次のブロック用Canvas取得
const nextContext = nextCanvas.getContext('2d'); // 次のブロック用コンテキスト取得
const holdCanvas = document.getElementById('holdCanvas'); // ホールド用Canvas取得
const holdContext = holdCanvas.getContext('2d'); // ホールド用コンテキスト取得

// --- Start Screen Elements ---
const startScreen = document.getElementById('startScreen');
const difficultyButtons = document.querySelectorAll('.difficultyButton');
const startButton = document.getElementById('startButton');
const demoButton = document.getElementById('demoButton'); // 追加

// --- Game Container Elements ---
const gameContainer = document.getElementById('gameContainer');
const gameOverScreen = document.getElementById('gameOverScreen'); // gameContainer内に移動
const finalScoreElement = document.getElementById('finalScore'); // gameContainer内に移動
const finalLevelElement = document.getElementById('finalLevel'); // gameContainer内に移動
const backToStartButton = document.getElementById('backToStartButton'); // 新しいボタン
const versionDisplay = document.getElementById('versionDisplay'); // バージョン表示用

// タッチコントロール用のボタン要素を取得
const touchLeftButton = document.getElementById('touchLeft');
const touchRightButton = document.getElementById('touchRight');
const touchRotateButton = document.getElementById('touchRotate');
const touchDownButton = document.getElementById('touchDown');
const touchDropButton = document.getElementById('touchDrop');
const touchHoldButton = document.getElementById('touchHold');
const touchControls = document.getElementById('touchControls'); // タッチコントロール全体のコンテナ

// --- Audio ---
// サウンドファイルを読み込む (audioフォルダにあると仮定)
const sounds = {
    move: new Audio('audio/move.mp3'), // .wav から .mp3 に変更
    rotate: new Audio('audio/rotate.wav'),
    place: new Audio('audio/place.wav'),
    clear: new Audio('audio/clear.wav'),
    levelup: new Audio('audio/levelup.wav'),
    gameover: new Audio('audio/gameover.wav')
};
let isSoundEnabled = true; // サウンド再生フラグ (初回クリック対策用)

// サウンド再生ヘルパー関数
function playSound(soundName) {
    if (!isSoundEnabled) return; // サウンドが無効なら再生しない

    const sound = sounds[soundName];
    if (sound) {
        sound.currentTime = 0; // 再生位置をリセット
        sound.play().catch(error => {
            // 自動再生ポリシーによるエラーをハンドル (特に初回インタラクション前)
            // console.error(`Error playing sound ${soundName}:`, error);
            // 必要であれば、ここで isSoundEnabled = false; にして以降の再生を試みないようにする
        });
    }
}

const grid = 20; // グリッドのサイズ
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;
const rows = canvasHeight / grid;
const cols = canvasWidth / grid;
const nextGrid = 20; // NEXT/HOLD表示用のグリッドサイズ (調整可能)

// テトリミノの形状と色を定義
const shapes = {
    'I': { shape: [[1, 1, 1, 1]], color: 'cyan' },
    'O': { shape: [[1, 1], [1, 1]], color: 'yellow' },
    'T': { shape: [[0, 1, 0], [1, 1, 1]], color: 'purple' },
    'S': { shape: [[0, 1, 1], [1, 1, 0]], color: 'green' },
    'Z': { shape: [[1, 1, 0], [0, 1, 1]], color: 'red' },
    'J': { shape: [[1, 0, 0], [1, 1, 1]], color: 'blue' },
    'L': { shape: [[0, 0, 1], [1, 1, 1]], color: 'orange' }
};
const shapeKeys = Object.keys(shapes);

// ゲームの状態
let field = [];
let currentTetromino = null;
let nextTetromino = null; // 次のテトリミノ
let heldTetromino = null; // ホールド中のテトリミノ
let canHold = true; // 現在のブロックでホールド可能か
let lastDropTime = 0;
let dropInterval = 1000; // 初期落下間隔
let score = 0;
let level = 1; // レベル変数
let linesClearedTotal = 0; // 累計消去ライン数
const linesPerLevel = 10; // レベルアップに必要なライン数
let isGameOver = false; // ゲームオーバーフラグ
let animationFrameId = null; // ゲームループID
let selectedDifficulty = null; // 選択された難易度 (easy, normal, hard)
const baseDropIntervals = { // 難易度ごとの基本落下間隔
    easy: 1200,
    normal: 1000,
    hard: 700
};
let isDemoMode = false; // デモモードフラグを追加
let demoAIIntervalId = null; // デモAIのインターバルIDを追加

// 表示用要素を取得
const scoreElement = document.getElementById('scoreDisplay');
const levelElement = document.getElementById('levelDisplay'); // レベル表示要素

// --- 関数定義 ---

// デモAIのインターバルを停止する関数
function stopDemoAI() {
    if (demoAIIntervalId) {
        clearInterval(demoAIIntervalId);
        demoAIIntervalId = null;
    }
}

// フィールドを初期化 (ゲーム開始・リスタート)
function initializeField() {
    for (let row = 0; row < rows; row++) {
        field[row] = [];
        for (let col = 0; col < cols; col++) {
            field[row][col] = 0; // 0は空きマス
        }
    }
    score = 0; // スコアリセット
    level = 1; // レベルリセット
    linesClearedTotal = 0; // 累計ライン数リセット
    // 難易度に基づいて初期落下間隔を設定
    dropInterval = calculateDropInterval(level);
    heldTetromino = null; // ホールドリセット
    canHold = true; // ホールドフラグリセット
    isGameOver = false; // ゲームオーバーフラグ解除
    isDemoMode = false; // デモモードをリセット
    stopDemoAI(); // デモAIインターバルを停止
    hideGameOverScreen(); // ゲームオーバー画面を隠す
    updateScoreDisplay(); // スコア表示更新
    updateLevelDisplay(); // レベル表示更新
    drawHeldTetromino(); // ホールド表示クリア
    // 最初のテトリミノを準備
    nextTetromino = getRandomTetromino(); // 最初のNEXTを生成
    spawnTetromino(); // 最初のcurrentを生成＆描画 (内部で drawNextTetromino も呼ばれる)

    // 既存のループがあればキャンセル
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    // ゲームループ開始
    lastDropTime = performance.now(); // タイマーリセット
    gameLoop();
}

// スコア表示を更新
function updateScoreDisplay() {
    scoreElement.textContent = `スコア: ${score}`;
}

// レベル表示を更新
function updateLevelDisplay() {
    levelElement.textContent = `レベル: ${level}`;
}

// レベルと難易度に応じて落下間隔を計算
function calculateDropInterval(currentLevel) {
    const baseInterval = baseDropIntervals[selectedDifficulty] || 1000; // 選択された難易度の基本値、なければnormal
    // レベルが上がるごとに速度を少しずつ上げる（例）
    // Math.maxで最低速度を保証
    return Math.max(baseInterval - (currentLevel - 1) * 75, 100);
}

// レベルアップ処理
function levelUp() {
    level++;
    dropInterval = calculateDropInterval(level); // 新しい落下間隔を設定
    updateLevelDisplay();
    playSound('levelup'); // レベルアップ音
    // レベルアップ時の演出など（任意）
    console.log(`Level Up! Level: ${level}, Drop Interval: ${dropInterval}`);
}

// ランダムなテトリミノデータを取得するヘルパー関数
function getRandomTetromino() {
    const randomShapeKey = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
    const tetrominoData = shapes[randomShapeKey];
    // データのみを返す（位置情報はspawn時に決定）
    return {
        shape: tetrominoData.shape,
        color: tetrominoData.color,
    };
}

// 新しいテトリミノを生成（実際にはNEXTから持ってくる）
function spawnTetromino() {
    // ゲームオーバー中は生成しない
    if (isGameOver) return;

    currentTetromino = nextTetromino; // NEXTを現在のにする
    currentTetromino.row = 0; // 開始位置を設定
    currentTetromino.col = Math.floor(cols / 2) - Math.floor(currentTetromino.shape[0].length / 2);

    // 出現位置で衝突チェック (ゲームオーバー判定)
    if (!isValidMove(currentTetromino, currentTetromino.row, currentTetromino.col)) {
         showGameOverScreen(); // ゲームオーバー画面表示
         return; // ゲームオーバーなら以降の処理はしない
    }

    nextTetromino = getRandomTetromino(); // 新しいNEXTを生成
    drawNextTetromino(); // NEXT表示を更新
}

// 指定された位置が移動可能かチェック
function isValidMove(tetromino, newRow, newCol) {
    for (let r = 0; r < tetromino.shape.length; r++) {
        for (let c = 0; c < tetromino.shape[r].length; c++) {
            if (tetromino.shape[r][c] === 1) {
                const checkRow = newRow + r;
                const checkCol = newCol + c;

                if (checkRow >= rows || checkCol < 0 || checkCol >= cols) {
                    return false;
                }
                // checkRow >= 0 のチェックを追加 (画面上部より上は常に有効とするため)
                if (checkRow >= 0 && field[checkRow][checkCol] !== 0) {
                    return false;
                }
            }
        }
    }
    return true;
}

// テトリミノをフィールドに固定
function placeTetromino() {
    if (!currentTetromino) return;
    currentTetromino.shape.forEach((rowShape, r) => {
        rowShape.forEach((cell, c) => {
            if (cell === 1) {
                const placeRow = currentTetromino.row + r;
                const placeCol = currentTetromino.col + c;
                // 画面上部より上にはみ出している部分は無視
                if (placeRow >= 0) {
                    field[placeRow][placeCol] = currentTetromino.color;
                }
            }
        });
    });
    canHold = true; // ブロックを設置したらホールド可能にする
    playSound('place'); // 設置音
}

// テトリミノを回転
function rotateTetromino() {
    if (!currentTetromino) return;

    const originalShape = currentTetromino.shape;
    const N = originalShape.length;
    const M = originalShape[0].length;

    const rotatedShape = [];
    for (let i = 0; i < M; i++) {
        rotatedShape[i] = [];
        for (let j = 0; j < N; j++) {
            rotatedShape[i][j] = 0;
        }
    }

    for (let r = 0; r < N; r++) {
        for (let c = 0; c < M; c++) {
            rotatedShape[c][N - 1 - r] = originalShape[r][c];
        }
    }

    const tempTetromino = { ...currentTetromino, shape: rotatedShape };
    if (isValidMove(tempTetromino, currentTetromino.row, currentTetromino.col)) {
        currentTetromino.shape = rotatedShape;
        playSound('rotate'); // 回転音
    }
    // else: 回転できない場合は何もしない (ウォールキックは未実装)
}

// ホールド処理
function holdTetromino() {
    if (isGameOver || !canHold) return; // ゲームオーバー中、ホールド不可なら何もしない

    if (heldTetromino === null) {
        // 初めてホールドする場合
        heldTetromino = { shape: currentTetromino.shape, color: currentTetromino.color }; // 位置情報なしで保存
        spawnTetromino(); // 次のブロックを出す (内部でゲームオーバーチェックもされる)
    } else {
        // ホールド中のブロックと交換する場合
        const temp = { shape: currentTetromino.shape, color: currentTetromino.color }; // 現在のを一時保存
        currentTetromino = heldTetromino; // ホールドしていたものを現在のに
        // 開始位置を設定
        currentTetromino.row = 0; 
        currentTetromino.col = Math.floor(cols / 2) - Math.floor(currentTetromino.shape[0].length / 2);
        heldTetromino = temp; // 一時保存したものをホールドへ

        // 交換後に出現位置で衝突しないかチェック
        if (!isValidMove(currentTetromino, currentTetromino.row, currentTetromino.col)) {
             showGameOverScreen(); // ゲームオーバー画面表示
             return; // ゲームオーバーなら以降の処理はしない
        }
    }

    canHold = false; // このブロックではもうホールドできない
    drawHeldTetromino(); // ホールド表示更新
}

// ゲームオーバー画面を表示
function showGameOverScreen() {
    isGameOver = true;
    cancelAnimationFrame(animationFrameId); // ゲームループ停止
    stopDemoAI(); // デモAIインターバルを停止
    finalScoreElement.textContent = `スコア: ${score}`; // 最終スコア表示
    finalLevelElement.textContent = `レベル: ${level}`; // 最終レベル表示
    gameOverScreen.classList.add('visible'); // 画面を表示
    playSound('gameover'); // ゲームオーバー音
    if (touchControls) touchControls.style.display = 'none'; // ゲームオーバー画面ではタッチコントロールを非表示
    // キーボードイベントリスナーを削除
    document.removeEventListener('keydown', handleKeyPress);
    // タッチイベントリスナーを削除
    if (touchLeftButton) touchLeftButton.removeEventListener('touchstart', handleTouchLeft);
    if (touchRightButton) touchRightButton.removeEventListener('touchstart', handleTouchRight);
    if (touchRotateButton) touchRotateButton.removeEventListener('touchstart', handleTouchRotate);
    if (touchDownButton) touchDownButton.removeEventListener('touchstart', handleTouchDown);
    if (touchDropButton) touchDropButton.removeEventListener('touchstart', handleTouchDrop);
    if (touchHoldButton) touchHoldButton.removeEventListener('touchstart', handleTouchHold);
}

// ゲームオーバー画面を隠す
function hideGameOverScreen() {
    gameOverScreen.classList.remove('visible'); // 画面を非表示
}

// --- 描画関数 ---

// フィールド描画関数
function drawField() {
    context.strokeStyle = '#ccc';
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (field[row][col] === 0) {
                context.fillStyle = '#f0f0f0';
                context.fillRect(col * grid, row * grid, grid, grid);
            } else {
                context.fillStyle = field[row][col];
                context.fillRect(col * grid, row * grid, grid - 1, grid - 1);
            }
            context.strokeRect(col * grid, row * grid, grid, grid);
        }
    }
}

// テトリミノ描画関数 (メインキャンバス用)
function drawTetromino(tetromino, ctx = context, g = grid, offsetX = 0, offsetY = 0) { // 引数追加
    ctx.fillStyle = tetromino.color;
    tetromino.shape.forEach((rowShape, r) => {
        rowShape.forEach((cell, c) => {
            if (cell === 1) {
                // row/colはテトリミノ自身のフィールド内座標、offsetX/Yは描画キャンバス上のグリッドオフセット
                const drawRow = tetromino.row + r + offsetY; 
                const drawCol = tetromino.col + c + offsetX; 
                // 描画対象のコンテキストがメイン(context)の場合のみ画面外チェック
                if (ctx === context && drawRow < 0) {
                    return; // 画面上部より上は描画しない
                }
                ctx.fillRect(drawCol * g, drawRow * g, g - 1, g - 1);
            }
        });
    });
}

// 次のテトリミノを描画する関数
function drawNextTetromino() {
    // nextCanvasをクリア
    nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextTetromino) return;

    // nextCanvasの中央に描画するためのオフセット計算
    const shapeWidth = nextTetromino.shape[0].length * nextGrid;
    const shapeHeight = nextTetromino.shape.length * nextGrid;
    // グリッド単位でのオフセットを計算
    const offsetX = Math.floor((nextCanvas.width - shapeWidth) / 2 / nextGrid);
    const offsetY = Math.floor((nextCanvas.height - shapeHeight) / 2 / nextGrid);

    // drawTetromino関数を再利用して描画
    // rowとcolは0として扱い、オフセットで位置調整
    const tempTetromino = { ...nextTetromino, row: 0, col: 0 }; // row/colは描画基点として0
    drawTetromino(tempTetromino, nextContext, nextGrid, offsetX, offsetY);
}

// ホールド中のテトリミノを描画する関数
function drawHeldTetromino() {
    holdContext.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
    if (!heldTetromino) return;
    const shapeWidth = heldTetromino.shape[0].length * nextGrid;
    const shapeHeight = heldTetromino.shape.length * nextGrid;
    const offsetX = Math.floor((holdCanvas.width - shapeWidth) / 2 / nextGrid);
    const offsetY = Math.floor((holdCanvas.height - shapeHeight) / 2 / nextGrid);
    const tempTetromino = { ...heldTetromino, row: 0, col: 0 }; // row/colは描画基点として0
    drawTetromino(tempTetromino, holdContext, nextGrid, offsetX, offsetY);
}

// --- ゲームループ ---

function gameLoop(currentTime = 0) {
    // ゲームループの最初に isGameOver をチェック
    if (isGameOver) {
        cancelAnimationFrame(animationFrameId); // 念のためループ停止
        return;
    }

    const deltaTime = currentTime - lastDropTime;

    // 落下処理 (dropInterval を使用)
    if (deltaTime > dropInterval) { // 変数 dropInterval を参照
        if (currentTetromino) {
            const newRow = currentTetromino.row + 1;
            if (isValidMove(currentTetromino, newRow, currentTetromino.col)) {
                currentTetromino.row = newRow;
            } else {
                placeTetromino(); // canHold が true になる
                const clearedLinesCount = clearLines(); // ライン消去処理を呼び出し
                addScore(clearedLinesCount);
                // 累計ライン数を更新し、レベルアップ判定
                if (clearedLinesCount > 0) {
                    linesClearedTotal += clearedLinesCount;
                    // レベルアップ条件を修正: 現在のレベルに必要な累計ライン数を超えたらレベルアップ
                    if (linesClearedTotal >= level * linesPerLevel) { 
                       levelUp();
                    }
                }
                spawnTetromino(); // この中でゲームオーバーチェックも行う
                // spawn後に canHold は true のまま
                // ゲームオーバーチェック
                if (!isValidMove(currentTetromino, currentTetromino.row, currentTetromino.col)) {
                    showGameOverScreen(); // ゲームオーバー画面表示
                    return; // ゲームオーバーなら以降の描画等は行わない
                }
            }
        } else {
             spawnTetromino(); // ゲーム開始時など
             if (isGameOver) return;
        }
        lastDropTime = currentTime;
    }

    // 画面クリア
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    // フィールド描画
    drawField();
    // 現在のテトリミノを描画
    if (currentTetromino) {
        drawTetromino(currentTetromino, context, grid); // contextとgridを明示的に渡す
    }
    // 次のテトリミノ描画は spawnTetromino 内で実施

    // 次のフレームを要求
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- ライン消去処理 ---
function clearLines() {
    let linesCleared = 0; // 消去した行数をカウント
    for (let r = rows - 1; r >= 0; r--) {
        // 行がすべて埋まっているかチェック
        if (field[r].every(cell => cell !== 0)) {
            linesCleared++; // 消去行数をインクリメント
            // その行を消去し、上の行をすべて1段下げる
            for (let y = r; y > 0; y--) {
                field[y] = field[y - 1];
            }
            // 一番上の行を空にする
            field[0] = Array(cols).fill(0);
            // 同じ行を再度チェックするためにインデックスを戻す
            r++;
            // スコア加算などの処理をここに追加
        }
    }
    if (linesCleared > 0) {
        playSound('clear'); // ライン消去音
    }
    return linesCleared; // 消去した行数を返す
}

// --- スコア加算処理 ---
function addScore(linesCleared) {
    // 消したライン数に応じたスコアテーブル
    const scoreTable = {
        1: 100, // 1ライン
        2: 300, // 2ライン
         3: 500, // 3ライン
        4: 800  // 4ライン (テトリス)
    };

    if (linesCleared > 0) {
        score += scoreTable[linesCleared] || 0; // テーブルに基づいてスコアを加算
        updateScoreDisplay(); // スコア表示を更新
    }
}

// --- Demo AI Logic (Placeholder) ---
function runDemoAI() {
    if (isGameOver || !currentTetromino) {
        stopDemoAI(); // ゲームオーバーなら停止
        return;
    }

    // --- ここからAIの思考ロジック ---
    // 現状は非常に単純なランダム移動のみ
    // TODO: より高度なAIロジック（最適な位置と回転を見つける）を実装する

    const possibleMoves = [];
    // 左移動可能か
    if (isValidMove(currentTetromino, currentTetromino.row, currentTetromino.col - 1)) {
        possibleMoves.push('left');
    }
    // 右移動可能か
    if (isValidMove(currentTetromino, currentTetromino.row, currentTetromino.col + 1)) {
        possibleMoves.push('right');
    }
    // 回転可能か (簡易チェック)
    // TODO: 回転後の形状でisValidMoveをチェックする
    possibleMoves.push('rotate');

    // 落下は自然落下に任せるか、一定確率で即時落下させるかなど
    possibleMoves.push('wait'); // 何もしない（自然落下）選択肢
    possibleMoves.push('wait'); // waitの確率を上げる

    // ランダムに次の行動を選択
    const randomAction = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

    // 選択された行動を実行
    switch (randomAction) {
        case 'left':
            currentTetromino.col--;
            playSound('move'); // playSound を呼び出す
            break;
        case 'right':
            currentTetromino.col++;
            playSound('move'); // playSound を呼び出す
            break;
        case 'rotate':
            rotateTetromino(); // rotateTetromino内で音再生
            break;
        case 'wait':
            // 何もしない
            break;
    }
    // --- AIの思考ロジックここまで ---
}

// --- イベントリスナー ---

// 難易度選択ボタンのリスナー
difficultyButtons.forEach(button => {
    button.addEventListener('click', () => {
        // 他のボタンの選択状態を解除
        difficultyButtons.forEach(btn => btn.classList.remove('selected'));
        // クリックされたボタンを選択状態にする
        button.classList.add('selected');
        // 選択された難易度を保存
        selectedDifficulty = button.dataset.difficulty;
        // スタートボタンを有効にする
        startButton.disabled = false;
    });
});

// スタートボタンのリスナー
startButton.addEventListener('click', () => {
    if (!selectedDifficulty) return; // 難易度が選択されていなければ何もしない

    // スタート画面を非表示
    startScreen.style.display = 'none';
    // ゲームコンテナを表示
    gameContainer.style.display = 'flex'; // display: flex に戻す

    // ゲーム初期化・開始
    initializeField();

    // キャンバスにフォーカスを当てる (キー操作を受け付けるため)
    canvas.focus();
});

// デモプレイボタンのリスナー
demoButton.addEventListener('click', () => {
    // デモプレイ用の難易度を固定（例: normal）
    selectedDifficulty = 'normal';
    // ボタンの選択状態は更新しない（見た目上）

    // スタート画面を非表示
    startScreen.style.display = 'none';
    // ゲームコンテナを表示
    gameContainer.style.display = 'flex';

    // デモモード開始
    isDemoMode = true;
    initializeField(); // ゲーム初期化

    // デモAIを開始 (例: 300msごとに行動決定)
    stopDemoAI(); // 念のため既存のインターバルをクリア
    demoAIIntervalId = setInterval(runDemoAI, 300); // 300msごとに行動

    // キャンバスにフォーカス
    canvas.focus();
});

document.addEventListener('keydown', (e) => {
    if (isDemoMode || isGameOver || !currentTetromino) return; // デモモード中、ゲームオーバー中は何もしない

    switch (e.key) {
        case 'ArrowLeft':
            if (isValidMove(currentTetromino, currentTetromino.row, currentTetromino.col - 1)) {
                currentTetromino.col--;
                playSound('move'); // 移動音
            }
            break;
        case 'ArrowRight':
            if (isValidMove(currentTetromino, currentTetromino.row, currentTetromino.col + 1)) {
                currentTetromino.col++;
                playSound('move'); // 移動音
            }
            break;
        case 'ArrowDown':
            const newRow = currentTetromino.row + 1;
            if (isValidMove(currentTetromino, newRow, currentTetromino.col)) {
                currentTetromino.row = newRow;
                lastDropTime = performance.now(); // タイマーリセット
                // playSound('move'); // 下移動でも音を鳴らす場合
            } else {
                // 即座に固定して次へ (落下タイマーを待たない)
                placeTetromino();
                const clearedLinesCount = clearLines(); // ライン消去
                addScore(clearedLinesCount); // スコア加算
                // 累計ライン数を更新し、レベルアップ判定
                if (clearedLinesCount > 0) {
                    linesClearedTotal += clearedLinesCount;
                     // レベルアップ条件を修正: 現在のレベルに必要な累計ライン数を超えたらレベルアップ
                    if (linesClearedTotal >= level * linesPerLevel) { 
                       levelUp();
                    }
                }
                spawnTetromino();
                 // ゲームオーバーチェック
                if (!isValidMove(currentTetromino, currentTetromino.row, currentTetromino.col)) {
                    showGameOverScreen(); // ゲームオーバー画面表示
                    return;
                }
            }
            break;
        case 'ArrowUp':
            rotateTetromino(); // rotateTetromino内で回転音が鳴る
            break;
        case 'c': // 'c' キーでホールド
        case 'C':
        case 'Shift': // Shiftキーでもホールドできるようにする（任意）
            holdTetromino();
            break;
    }
});

// スタート画面に戻るボタンのリスナー
backToStartButton.addEventListener('click', () => {
    hideGameOverScreen(); // ゲームオーバー画面を隠す
    gameContainer.style.display = 'none'; // ゲームコンテナを隠す
    startScreen.style.display = 'flex'; // スタート画面を表示
    // 難易度選択状態をリセット
    difficultyButtons.forEach(btn => btn.classList.remove('selected'));
    selectedDifficulty = null;
    startButton.disabled = true;

    // デモモード関連のリセット
    isDemoMode = false;
    stopDemoAI(); // デモAIインターバルを停止
});

// タッチイベントハンドラ
function handleTouchLeft(event) {
    event.preventDefault(); // デフォルトのタッチイベント（スクロールなど）を無効化
    if (!isGameOver && !isPaused) {
        moveLeft();
    }
}

function handleTouchRight(event) {
    event.preventDefault();
    if (!isGameOver && !isPaused) {
        moveRight();
    }
}

function handleTouchRotate(event) {
    event.preventDefault();
    if (!isGameOver && !isPaused) {
        rotate();
    }
}

function handleTouchDown(event) {
    event.preventDefault();
    if (!isGameOver && !isPaused) {
        moveDown();
    }
}

function handleTouchDrop(event) {
    event.preventDefault();
    if (!isGameOver && !isPaused) {
        hardDrop();
    }
}

function handleTouchHold(event) {
    event.preventDefault();
    if (!isGameOver && !isPaused) {
        holdBlock();
    }
}

// キーボード操作
function handleKeyPress(event) {
    if (isGameOver || isPaused) return;

    // event.key を使用する方が望ましい
    switch (event.key) {
        case 'ArrowLeft':
        case 'a': // Aキーも左移動に対応
            moveLeft();
            break;
        case 'ArrowRight':
        case 'd': // Dキーも右移動に対応
            moveRight();
            break;
        case 'ArrowUp':
        case 'w': // Wキーも回転に対応
            rotate();
            break;
        case 'ArrowDown':
        case 's': // Sキーもソフトドロップに対応
            moveDown();
            break;
        case ' ': // スペースキーでハードドロップ
            hardDrop();
            break;
        case 'Shift': // Shiftキーでホールド
        case 'c': // Cキーでもホールド可能に
            holdBlock();
            break;
        case 'Escape': // Escapeキーでポーズ/再開
             togglePause();
            break;
    }
}

// 初期化処理の変更
window.onload = () => {
    showStartScreen();
    if (versionDisplay) {
        versionDisplay.textContent = `v${gameVersion}`;
    }
};

// 画面リサイズ時のタッチコントロール表示制御
window.addEventListener('resize', () => {
    if (gameContainer.style.display === 'flex' && !isGameOver && !isPaused) {
        if (window.innerWidth <= 600) {
            if (touchControls) touchControls.style.display = 'grid';
        } else {
            if (touchControls) touchControls.style.display = 'none';
        }
    }
});

// --- ゲーム開始 ---

// 初回ユーザー操作時にサウンド再生を試みる (ブラウザの自動再生制限対策)
document.body.addEventListener('click', () => {
    // ダミーの無音サウンドなどを再生試行することで、
    // 以降のプログラムによる再生が許可されることがある
    const dummySound = new Audio();
    dummySound.play().catch(()=>{});
}, { once: true }); // 一度だけ実行
