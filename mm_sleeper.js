/* global Module */

/* Magic Mirror
 * Module: mm_sleeper
 *
 * By Hanno Buhmes
 * MIT Licensed.
 */

function loadDataAndStoreToDB(formatterCallback, targetStore, urlApi, self) {

	console.debug("handle: " + targetStore);

	let responsePromise = fetch(urlApi);
	responsePromise.then(async function (response) {
		console.log(response.status);

		if (response.status === 200) {
			await response.json().then(function (dataFromAPI) {

				formatterCallback(dataFromAPI).then(datenAusAPIReduziert => storeDownloadInDB(targetStore, datenAusAPIReduziert));

			});
		} else if (response.status === 401) {
			self.updateDom(self.config.animationSpeed);
			Log.error(self.name, response.status);
			retry = false;
		} else {
			Log.error(self.name, "Could not load data.");
		}


	});

}

function minutesSince(ts) {
	if (ts == null) return;
	return Math.floor((Date.now() - ts) / 60000);
}



function checkIfUpdateNeeded(store, treshold) {
	return new Promise(function (resolve,reject) {
		loadValueByIdFromStore(TIMESTAMPS_STORE, store).then(
			function (result) {
				let minutesSince1 = minutesSince(result.ts);
				console.debug("found: " + result.ts);
				console.debug(store + " is: " + minutesSince1 + " minutes old, treshold is: " + treshold);
				if (minutesSince1 >= treshold)
					resolve(true);
				else
					resolve(false);
			}
		).catch(function () {
			console.log("no entry found, time to change that")
			resolve(true);
		});
	});

}

function initializeEmptyWithHeaders(page, maxpage, header) {
	$("#player-list").hide();
	$('#player-list').empty();
	let list = $('<ul/>').appendTo('#player-list');
	$('#nfl-title').html('<i class="fas fa-football-ball"></i> ' + header + ' ('+ TRENDINGLOOKBACKHOURS+'h) ' + page + '/' + maxpage+'');

	$('#nfl-title').append('<div class="player-list-header"><span class="list-col-count"> count </span><span class="list-col-owner"> owner </span><span class="list-col-player">player</span></div>');
	$('#nfl-title').append('<div class="progress-bar"><span class="progress-bar-fill" style="width: 0.1%"></span></div>');
	return list;
}

function singleRow(data) {
	return '<li><span class="list-col-count">' + data.count + '</span><span class="list-col-owner">'
		+ ((data.owner != null) ? data.owner : 'Free Agent') + '</span><span class="list-col-player">'
		+ data.displayname + '</span></li>';
}



function translateHeader(header) {
	if (header===TRENDING_PLAYERS_STORE) return "ADDED PLAYERS";
	if (header===TRENDING_PLAYERS_DROPPED_STORE) return "DROPPED PLAYERS";
	return header;
}

async function displayDataFromDB(ids) {
	let objectData = await loadValueByIdFromStore(ids[0], null);
	objectData.sort((a, b) => (a.count < b.count ? 1 : -1));
	let delay = 5000;
	let displayIndex = 0;
	let pagesize = 6;
	let page = 0;
	let header=ids[0];

	setInterval(() => {

		if (objectData.length <= displayIndex) {
			displayIndex = page = 0;
		}

		let list = initializeEmptyWithHeaders(++page, Math.ceil(objectData.length / pagesize), translateHeader(header));

		objectData.slice(displayIndex, displayIndex + pagesize).forEach(function (data) {
			list.append(singleRow(data));
		});
		$('.progress-bar-fill').progressbar({
			create: function (event, ui) {
				$("#player-list").fadeIn("slow");
				$(this).css('width', '100%')
			}
		});
		displayIndex = displayIndex + pagesize;


	}, delay);

	let idx = 0;
	setInterval(async () => {
		idx = (idx === ids.length-1) ? 0 : (idx + 1);
		console.debug("switching to " + ids[idx]);
		objectData = await loadValueByIdFromStore(ids[idx], null);
		objectData.sort((a, b) => (a.count < b.count ? 1 : -1));
		header=ids[idx];
		displayIndex = page = 0;

	}, delay * 2  * Math.ceil(TRENDINGPLAYERLIMIT / pagesize));


}

const TRENDING_PLAYERS_STORE = "trendingPlayers";
const TRENDING_PLAYERS_DROPPED_STORE = "trendingPlayersDropped";
const ROSTERS_STORE = "rosters";
const OWNERS_STORE = "owners";
const PLAYERS_STORE = "players";
const TIMESTAMPS_STORE = "timestamps";
const TRENDINGLOOKBACKHOURS = 8;
const TRENDINGPLAYERLIMIT = 20;
const DB_VERSION = 17;
const DBNAME = "sleeperdb";

Module.register("mm_sleeper", {
	defaults: {
		updateInterval: 60000,
		retryDelay: 5000,

	},

	requiresVersion: "2.1.0", // Required version of MagicMirror

	start: function() {
		const self = this;

		//Flag for check if module is loaded
		this.loaded = false;


		// Schedule update timer.
		this.getData();
		setInterval(function () {
			self.updateDom();
		}, this.config.updateInterval);

		openAndInitDB();
		setInterval(self.updateNFL(TRENDING_PLAYERS_STORE, TRENDING_PLAYERS_DROPPED_STORE), 20000)
		setInterval(self.updateDatabase, 10000)
	},
	updateNFL: function (...ids) {
		displayDataFromDB(ids);
	},
	updateDatabase: function () {

		//BASE Tables per League
		//TODO: multiple Leagues
		// const leagueID = "726127230773702656";
		const leagueID = "665226048383815680";


		let targets = [
			{
				store: ROSTERS_STORE,
				maxAge: 15,
				processor: prepareRosterData,
				urlAPI: "https://api.sleeper.app/v1/league/" + leagueID + "/rosters"
			},
			{
				store: OWNERS_STORE,
				maxAge: 15,
				processor: prepareOwnerData,
				urlAPI: "https://api.sleeper.app/v1/league/" + leagueID + "/users"
			},
			{
				store: PLAYERS_STORE,
				maxAge: 24*60,
				processor: preparePlayerData,
				urlAPI: "https://api.sleeper.app/v1/players/nfl"
				// urlAPI: "https://b85211ee-09ec-437d-943e-eb06de1e4294.mock.pstmn.io/allPlayers"
			},
			{
				store: TRENDING_PLAYERS_STORE,
				maxAge: 5,
				processor: prepareTrendingPlayersData,
				urlAPI: "https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=" + TRENDINGLOOKBACKHOURS + "&limit=" + TRENDINGPLAYERLIMIT
			},
			{
				store: TRENDING_PLAYERS_DROPPED_STORE,
				maxAge: 5,
				processor: prepareTrendingPlayersData,
				urlAPI: "https://api.sleeper.app/v1/players/nfl/trending/drop?lookback_hours=" + TRENDINGLOOKBACKHOURS + "&limit=" + TRENDINGPLAYERLIMIT
			}
		]

		for (const target of targets) {
			checkIfUpdateNeeded(target.store, target.maxAge).then(function (updateNeeded) {
				if (updateNeeded) {
					loadDataAndStoreToDB(target.processor, target.store, target.urlAPI, self)
				} else
					console.debug("all good, no update needed ");
			});
		}


		// TODO: enrichLogic


	},

	/*
	 * getData
	 * function example return data and show it in the module wrapper
	 * get a URL request
	 *
	 */
	getData: function() {
		var self = this;
		if (!window.indexedDB) {
			console.log("Ihr Browser kein IndexedDB, WTF?");
		}



	},


	/* scheduleUpdate()
	 * Schedule next update.
	 *
	 * argument delay number - Milliseconds before next update.
	 *  If empty, this.config.updateInterval is used.
	 */
	scheduleUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}
		var self = this;
		setTimeout(function() {
			self.getData();
		}, nextLoad);
	},

	getDom: function() {
		var self = this;

		// create element wrapper for show into the module
		if (!document.getElementById("player-wrapper")) {
			var wrapper = document.createElement("div");
				wrapper.className = "player-wrapper";
			var wrapperDataRequest = document.createElement("div");
				wrapperDataRequest.className = "player-data";
			var labelDataRequest = document.createElement("label");
				labelDataRequest.setAttribute("id", "nfl-title");
				labelDataRequest.innerHTML = '<i class="fas fa-spinner"></i> LOADING NFL-NEWS'
			wrapper.appendChild(labelDataRequest);
			// create player-list-wrapper
			var playerDataWrapper = document.createElement("div");
				playerDataWrapper.setAttribute("id", "player-list");
				wrapper.appendChild(playerDataWrapper);
		}

		// Data from helper
		if (this.dataNotification) {
			var wrapperDataNotification = document.createElement("div");
			// translations  + datanotification
			wrapperDataNotification.innerHTML =  this.translate("UPDATE") + ": " + this.dataNotification.date;

		}
		return wrapper;
	},

	getScripts: function() {
		return [
			'jquery-3.6.0.min.js',
			'jquery-ui.min.js',
			'font-awesome-kit.js'
		]
	},

	getStyles: function () {
		return [
			"mm_sleeper.css",
			"jquery-ui.min.css"
		];
	},

	// Load translations files
	getTranslations: function() {
		//FIXME: This can be load a one file javascript definition
		return {
			en: "translations/en.json",
			es: "translations/es.json"
		};
	},

	processData: function(data) {
		var self = this;
		if (this.loaded === false) { self.updateDom(self.config.animationSpeed) ; }
		this.loaded = true;

		// the data if load
		// send notification to helper
		this.sendSocketNotification("sleeper-NOTIFICATION_TEST", data);
	},

	// socketNotificationReceived from helper
	socketNotificationReceived: function (notification, payload) {
		if(notification === "sleeper-NOTIFICATION_TEST") {
			// set dataNotification
			this.dataNotification = payload;
			this.updateDom();
		}
	},
});

let db;
// IndexedDB


function initializeStores(request) {
	return function () {
		console.log("db und stores nicht vorhanden oder version höher, alles wird angelegt. ");

		const db = request.result;
		const array = [OWNERS_STORE, TRENDING_PLAYERS_STORE, TIMESTAMPS_STORE, ROSTERS_STORE, TRENDING_PLAYERS_DROPPED_STORE, PLAYERS_STORE]

		array.forEach(function (storename) {

			try {
				console.debug("deleting " + storename);
				db.deleteObjectStore(storename)
			} catch (e) {
				console.log(storename + " did not exist")
			}
			db.createObjectStore(storename, {keyPath: "id"});
			console.debug("created " + storename);
		});

	};
}


function openAndInitDB() {

	var request = indexedDB.open(DBNAME, DB_VERSION);
	request.onerror = function (event) {
		window.alert(event)
	};

	request.onupgradeneeded = initializeStores(request);
	return request;
}

function storeDownloadInDB(targetStore, datenAusAPI) {


	var request = openAndInitDB();

	request.onsuccess = function () {
		const db = request.result;
		console.debug("db inserts...");

		const objectStore = db.transaction(targetStore, "readwrite").objectStore(targetStore);
		objectStore.clear().onsuccess = function insertNew() {
			console.debug("cleared " + targetStore);

			for (const ownerEintrag of datenAusAPI) {
				objectStore.add(ownerEintrag);
			}
			console.debug("added " + datenAusAPI.length + " entries to " + targetStore)
		}

		const timeStampstore = db.transaction(TIMESTAMPS_STORE, "readwrite").objectStore(TIMESTAMPS_STORE);
		let ts = Date.now();
		timeStampstore.put({id: targetStore, ts: ts})
		console.debug("wrote: " + targetStore + " " + ts + " to timestampstore");
		db.close();
	}

}

function loadValueByIdFromStore(targetStore, lookupid) {


	return new Promise(function(resolve, reject) {
		var request = openAndInitDB();

		request.onsuccess = function () {
			const db = request.result;
			let objectStore = db.transaction(targetStore, "readonly").objectStore(targetStore);
			let storeRequest;

			if(lookupid == null)
				 storeRequest = objectStore.getAll();
			else
				storeRequest = objectStore.get(lookupid);

			storeRequest.onsuccess = function(event) {
				if (storeRequest.result) resolve(storeRequest.result);
				else reject(Error('object not found'));
			};
			db.close();
		}

	});

}

async function prepareOwnerData(users) {
	return new Promise(function (resolve) {
		let ownerData = [];
		for (const {user_id, display_name} of users) {

			ownerData.push({id: user_id, name: display_name, type: "ownerData",})
		}
		resolve(ownerData);
	});
}

async function preparePlayerData(players) {
	return new Promise(function (resolve) {
		let playerData = [];


		function* entries(obj) {
			for (let key of Object.keys(obj)) {
				yield [key, obj[key]];
			}
		}

		for (let [key, value] of entries(players)) {
			playerData.push({
				id: key, first_name: value.first_name, last_name: value.last_name,
				position: value.position, team: value.team, type: "playerData",
			})
		}


		resolve(playerData);
	});
}

async function prepareRosterData(users) {
	return new Promise(function (resolve) {
		let rosterData = [];

		for (const {owner_id, players} of users) {
			rosterData.push({id: owner_id, players: players, type: "rosterData",})
		}
		resolve(rosterData);
	});
}

function findOwnerOfPlayer(player_search_id) {
	return new Promise(function (resolve) {
		function searchForPlayer(owners, player_search_id) {
			for (const{id, players} of owners) {
				for (const player_id of players)
					if (player_id === player_search_id) {
						resolve(id);
					}
			}
			resolve(null);
		}

		loadValueByIdFromStore("rosters")
			.then(result => searchForPlayer(result, player_search_id));

	});
}

async function findPlayer(player_id) {
	return new Promise(function (resolve) {

		loadValueByIdFromStore("players", player_id)
			.then(result => resolve(result));

	});
}

async function prepareTrendingPlayersData(players) {
	return new Promise(async function (resolve) {
		let tpData = [];
		for (const player of players) {
			await findPlayer(player.player_id).then(async playerFromDB => {
				const displayname = playerFromDB.first_name + " " + playerFromDB.last_name + " (" + playerFromDB.position + ") " + (playerFromDB.team!=null?playerFromDB.team:"");
				await (findOwnerOfPlayer(player.player_id)).then(async ownerid => {
						let ownername = null;

						if (ownerid != null) {
							await loadValueByIdFromStore(OWNERS_STORE, ownerid).then(
								result => ownername = result.name
							)
						}
						tpData.push({
							id: player.player_id,
							count: player.count,
							owner: ownername,
							displayname: displayname,
							type: "TrendingPlayers"
						});
					}
				);

			});


		}
		resolve(tpData);
	});
}

  
