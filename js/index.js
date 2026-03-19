/*
 * Yes, this code isn't great, but it's small and works even in IE10.
 * I wasn't configuring babel/webpack for a one off fun project.
 */

(function() {
	var contestants = [];

	var locked = false;

	var currentGameId = null;
	var currentBackground = null;
	var STORAGE_KEY = 'tm-games';

	var main = document.querySelector("main");
	var fileInput = document.querySelector("#file-input");
	var playButton = document.querySelector("#play-button");

	// Shared background file input + callback pattern
	var bgInput = document.createElement('input');
	bgInput.type = 'file';
	bgInput.accept = 'image/*';
	bgInput.style.display = 'none';
	document.body.appendChild(bgInput);

	var bgCallback = null;
	bgInput.addEventListener('change', function () {
		var file = bgInput.files && bgInput.files[0];
		var cb = bgCallback;
		bgCallback = null;
		bgInput.value = '';
		if (file && cb) {
			var reader = new FileReader();
			reader.onload = function (e) { cb(e.target.result); };
			reader.readAsDataURL(file);
		}
	});

	// Background button fixed to body (doesn't scale with main)
	var bgBtn = document.createElement('button');
	bgBtn.id = 'bg-btn';
	bgBtn.innerText = 'Change Background';
	bgBtn.style.display = 'none';
	bgBtn.addEventListener('click', function () {
		console.log('[bg] button clicked, setting bgCallback');
		bgCallback = function (url) {
			console.log('[bg] callback called, url length:', url && url.length);
			applyBackground(url);
			saveCurrentGame();
		};
		bgInput.click();
	});
	document.body.appendChild(bgBtn);

	function applyBackground(url) {
		console.log('[bg] applyBackground called, url length:', url && url.length, 'currentBg before:', currentBackground && currentBackground.length);
		currentBackground = url;
		document.documentElement.style.backgroundImage = url ? 'url(' + url + ')' : '';
		console.log('[bg] documentElement.style.backgroundImage set to:', document.documentElement.style.backgroundImage.slice(0, 60));
	}

	function generateId() {
		return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
	}

	function loadGames() {
		try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
		catch (e) { return []; }
	}

	function saveGames(games) {
		try { localStorage.setItem(STORAGE_KEY, JSON.stringify(games)); }
		catch (e) { console.warn('tm-scoreboard: localStorage save failed', e); }
	}

	function saveCurrentGame() {
		if (currentGameId === null) return;
		var games = loadGames();
		var data = contestants.map(function (con) {
			return { image: con.image, score: con.score, oldScore: con.oldScore };
		});
		var found = false;
		for (var i = 0; i < games.length; i++) {
			if (games[i].id === currentGameId) {
				games[i].contestants = data;
				games[i].locked = locked;
				games[i].background = currentBackground;
				games[i].updatedAt = Date.now();
				found = true;
				break;
			}
		}
		if (!found) {
			games.push({ id: currentGameId, updatedAt: Date.now(), locked: locked, background: currentBackground, contestants: data });
		}
		saveGames(games);
	}

	function addContestant(image) {
		var contestant = {};

		contestant.image = !!image ? image : "./images/blank.jpg";
		contestant.score = 0;
		contestant.oldScore = 0;

		contestants.push(contestant);

		return contestants.length;
	}

	function removeContestant(idx) {
		contestants.splice(idx, 1);
	}

	function createContestantEl(con, id) {
		var el = document.createElement("div");
		el.classList.add("contestant");

		var frameScaler = document.createElement("div");
		frameScaler.classList.add("frame-scaler");

		var frameContainer = document.createElement("div");
		frameContainer.classList.add("frame-container");
		frameContainer.style.webkitAnimationDelay = -id * 1.25 + "s";
		frameContainer.style.animationDelay = -id * 1.25 + "s";

		var fill = document.createElement("div");
		fill.classList.add("fill");
		fill.style.backgroundImage = "url(" + con.image + ")";
		if (!locked) showPlay();

		var shadow = document.createElement("div");
		shadow.classList.add("shadow");

		var frame = document.createElement("img");
		frame.src = "./images/frame.png";
		frame.classList.add("frame");
		frame.removeAttribute("width");
		frame.removeAttribute("height");

		frame.addEventListener("click", function() {
			var cb = function () {
				if (fileInput.files && fileInput.files[0]) {
					var reader = new FileReader();
					reader.onload = function (e) {
						con.image = e.target.result;
						fill.style.backgroundImage = "url(" + con.image + ")";
						saveCurrentGame();
					};
					reader.readAsDataURL(fileInput.files[0]);
				}
				fileInput.removeEventListener("change", cb);
				fileInput.value = "";
			};

			fileInput.addEventListener("change", cb);
			fileInput.click();
		});

		var exitBtn = document.createElement("button");
		exitBtn.classList.add("exit-button");
		exitBtn.innerText = "X";
		exitBtn.addEventListener("click", function () {
			removeContestant(id - 1);
			refreshContestants();
			resize();
			saveCurrentGame();
		});

		fill.appendChild(shadow);
		frameContainer.appendChild(fill);
		frameContainer.appendChild(frame);

		if (!locked) frameContainer.appendChild(exitBtn);

		frameScaler.appendChild(frameContainer);

		var scoreContainer = document.createElement("div");
		scoreContainer.classList.add("score-container");

		var seal = document.createElement("img");
		seal.classList.add("seal");
		seal.src = "./images/seal.png";
		seal.removeAttribute("width");
		seal.removeAttribute("height");

		var score = document.createElement("h1");
		score.classList.add("score");
		score.innerText = con.oldScore;

		scoreContainer.appendChild(seal);
		scoreContainer.appendChild(score);

		var input = document.createElement("input");
		input.classList.add("score-edit");
		input.type = "number";

		scoreContainer.isOpen = false;
		scoreContainer.addEventListener("mouseup", function(evt) {
			scoreContainer.isOpen = !scoreContainer.isOpen;

			if(scoreContainer.isOpen) {
				scoreContainer.appendChild(input);
				input.value = con.score;
				input.focus();
				input.select();
			} else {
				scoreContainer.removeChild(input);
			}
		});

		var exit = function() {
			scoreContainer.isOpen = false;
			scoreContainer.removeChild(input);

			var score = !!input.value ? parseFloat(input.value) : 0;

			if (con.score != score) {
				con.score = score;
				showPlay();
				saveCurrentGame();
			}
		};

		input.addEventListener("focusout", exit);
		input.addEventListener("onkeydown", function(evt) {
			if (evt.key === "Enter") {
				exit();
			}
		});

		input.addEventListener("mouseup", function(evt) {
			evt.stopPropagation();
			evt.stopImmediatePropagation();
		});

		el.appendChild(frameScaler);
		el.appendChild(scoreContainer);

		return el;
	}

	function transformContestants() {

		contestants.sort(function(first, second) {
			if (first.score < second.score) {
				return -1;
			} else if (first.score > second.score) {
				return 1;
			} else {
				return 0;
			}
		});


		var maxScore = contestants[contestants.length - 1].score;
		var maxCount = 1;

		for (var i = contestants.length - 1; i > 0; --i) {
			var con = contestants[i-1];
			if (con.score == maxScore) {
				++maxCount;
			}
		}

		for (var i = 0, l = contestants.length; i < l; ++i) {
			var con = contestants[i];

			con.el.style.msTransform = "translateX(" + (275 * i + 30) + "px)";
			con.el.style.transform = "translateX(" + (275 * i + 30) + "px)";

			if (con.score == maxScore) {
				if (maxCount > 2) {
					con.el.children[0].classList.remove("larger");
					con.el.children[0].classList.add("large");
				} else {
					con.el.children[0].classList.remove("large");
					con.el.children[0].classList.add("larger");
				}
			} else {
				con.el.children[0].classList.remove("large");
				con.el.children[0].classList.remove("larger");
			}
		}
	}

	function createAdd(len) {
		var res = document.createElement("button");

		res.innerText = "+";

		res.classList.add("add-button")

		res.style.msTransform = "translateX(" + (275 * len + 30) + "px)";
		res.style.transform = "translateX(" + (275 * len + 30) + "px)";

		res.addEventListener("click", function() {
			addContestant();
			refreshContestants();
			resize();
			saveCurrentGame();
		});

		return res;
	}

	function refreshContestants() {
		main.innerHTML = "";

		for (var i = contestants.length; i > 0; --i) {
			var con = contestants[i-1];

			var cEl = createContestantEl(con, i);
			con.el = cEl;
		}

		if (contestants.length > 0) transformContestants();

		for (var i = contestants.length; i > 0; --i) {
			var con = contestants[i-1];
			main.appendChild(con.el);
		}

		if (!locked) {
			main.appendChild(createAdd(contestants.length));
		}
	}

	function ease(t, a, b) {
		var eased = t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
		return (b - a) * eased + a;
	}

	function showPlay() {
		playButton.style.display = "block";
	}

	function play() {
		playButton.style.display = "none";
		bgBtn.style.display = 'none';

		if (!locked) {
			locked = true;

			document.body.classList.add("locked");

			resize();
			saveCurrentGame();
		}

		setTimeout(function() {
			var start = 0;
			var loop = function(dt) {
				if (start == 0) {
					start = dt;
				}

				for (var i = 0, l = contestants.length; i < l; ++i) {
					var con = contestants[i];

					var startRemainder = con.oldScore - Math.floor(con.oldScore);
					var endRemainder = con.score - Math.floor(con.score);

					var scoreEl = con.el.querySelector(".score");

					var score = Math.round(ease(Math.min((dt - start) / 2000, 1), Math.floor(con.oldScore), Math.floor(con.score)));

					if (dt - start < 1000) {
						score += startRemainder;
					} else {
						score += endRemainder;
					}

					scoreEl.innerText = score;
				}

				if (dt - start < 2000) {
					window.requestAnimationFrame(loop);
				} else {
					for (var i = 0, l = contestants.length; i < l; ++i) {
						var con = contestants[i];
						con.oldScore = con.score;
					}
					saveCurrentGame();
				}
			};

			window.requestAnimationFrame(loop);
			transformContestants();
		}, 1000);
	}

	playButton.addEventListener("mouseup", play);

	// --- Game management ---

	function startNewGame() {
		currentGameId = generateId();
		contestants = [];
		locked = false;
		document.body.classList.remove("locked");
		playButton.style.display = "none";
		applyBackground(null);
		for (var i = 0; i < 5; i++) addContestant();
		saveCurrentGame();
		hideSelectionScreen();
		bgBtn.style.display = 'block';
		refreshContestants();
		resize();
	}

	function resumeGame(game) {
		currentGameId = game.id;
		contestants = [];
		locked = false;
		if (locked) { document.body.classList.add("locked"); }
		else { document.body.classList.remove("locked"); }
		playButton.style.display = "none";
		applyBackground(game.background || null);
		for (var i = 0; i < game.contestants.length; i++) {
			var s = game.contestants[i];
			contestants.push({ image: s.image, score: s.score, oldScore: s.oldScore });
		}
		hideSelectionScreen();
		bgBtn.style.display = 'block';
		refreshContestants();
		resize();
		// Show play button if any score is pending animation
		for (var i = 0; i < contestants.length; i++) {
			if (contestants[i].score !== contestants[i].oldScore) {
				showPlay();
				break;
			}
		}
	}

	function deleteGame(id) {
		var games = loadGames().filter(function (g) { return g.id !== id; });
		saveGames(games);
		showSelectionScreen();
	}

	function createGameRow(game) {
		var row = document.createElement('div');
		row.classList.add('game-row');

		// Background thumbnail (clickable to change BG for this game)
		var bgThumb = document.createElement('div');
		bgThumb.classList.add('game-bg-thumb');
		bgThumb.title = 'Change background';
		if (game.background) {
			bgThumb.style.backgroundImage = 'url(' + game.background + ')';
		}
		bgThumb.addEventListener('click', (function (g, thumb) {
			return function () {
				bgCallback = function (url) {
					g.background = url;
					thumb.style.backgroundImage = 'url(' + url + ')';
					var games = loadGames();
					for (var i = 0; i < games.length; i++) {
						if (games[i].id === g.id) { games[i].background = url; break; }
					}
					saveGames(games);
				};
				bgInput.click();
			};
		})(game, bgThumb));
		row.appendChild(bgThumb);

		// Contestant face thumbnails
		var thumbs = document.createElement('div');
		thumbs.classList.add('game-thumbs');
		for (var i = 0; i < game.contestants.length; i++) {
			var thumb = document.createElement('div');
			thumb.classList.add('game-thumb');
			if (game.contestants[i].image && game.contestants[i].image !== './images/blank.jpg') {
				thumb.style.backgroundImage = 'url(' + game.contestants[i].image + ')';
			}
			thumbs.appendChild(thumb);
		}
		row.appendChild(thumbs);

		var date = document.createElement('span');
		date.classList.add('game-date');
		var d = new Date(game.updatedAt);
		date.innerText = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
		row.appendChild(date);

		var resumeBtn = document.createElement('button');
		resumeBtn.classList.add('sel-btn', 'sel-btn-resume');
		resumeBtn.innerText = 'Resume';
		resumeBtn.addEventListener('click', (function (g) { return function () { resumeGame(g); }; })(game));
		row.appendChild(resumeBtn);

		var deleteBtn = document.createElement('button');
		deleteBtn.classList.add('sel-btn', 'sel-btn-delete');
		deleteBtn.innerText = 'Delete';
		deleteBtn.addEventListener('click', (function (gid) { return function () { deleteGame(gid); }; })(game.id));
		row.appendChild(deleteBtn);

		return row;
	}

	function showSelectionScreen() {
		hideSelectionScreen();
		bgBtn.style.display = 'none';
		applyBackground(null);
		var games = loadGames();

		var screen = document.createElement('div');
		screen.id = 'sel-screen';

		var title = document.createElement('h1');
		title.classList.add('sel-title');
		title.innerText = 'Taskmaster Scoreboard';
		screen.appendChild(title);

		if (games.length > 0) {
			var list = document.createElement('div');
			list.classList.add('game-list');
			for (var i = 0; i < games.length; i++) list.appendChild(createGameRow(games[i]));
			screen.appendChild(list);
		}

		var newBtn = document.createElement('button');
		newBtn.classList.add('sel-btn', 'sel-btn-new');
		newBtn.innerText = 'New Game';
		newBtn.addEventListener('click', startNewGame);
		screen.appendChild(newBtn);

		document.body.appendChild(screen);
	}

	function hideSelectionScreen() {
		var s = document.getElementById('sel-screen');
		if (s) s.parentNode.removeChild(s);
	}

	// --- Initialization ---

	var games = loadGames();
	if (games.length === 0) {
		// First ever load: no saved games, go straight to scoreboard
		currentGameId = generateId();
		for (var i = 0; i < 5; ++i) addContestant();
		saveCurrentGame();
		bgBtn.style.display = 'block';
		refreshContestants();
	} else {
		// Saved games exist: show selection screen
		showSelectionScreen();
	}

	function resize(rep) {
		var w = window.innerWidth;
		var h = window.innerHeight;

		var wm = 1400 * ((contestants.length + (locked ? 0 : 0.25)) / 5);

		var m = Math.min(w / wm, h / 1080);

		main.style.msTransform = "scale(" + m + ")";
		main.style.transform = "scale(" + m + ")";

		main.style.left = (w - wm * m) / 2 + "px";
	}

	window.addEventListener("resize", resize);
	resize();
})();
