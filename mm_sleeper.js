/* global Module */

/* Magic Mirror
 * Module: mm_sleeper
 *
 * By Hanno Buhmes
 * MIT Licensed.
 */
function loadDataAndStoreToDB(formatterCallback, targetStore, urlApi, self) {

	console.log("handle: " + targetStore);

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
		loadValueByIdFromStore("timestamps", store).then(
			function (result) {
				let minutesSince1 = minutesSince(result.ts);
				console.log("found: " + result.ts);
				console.log(store + " is: " + minutesSince1 + " minutes old, treshold is: " + treshold);
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

function displayDataFromDB(id) {
	loadValueByIdFromStore(id).then((objectData) => {
		let displayIndex = 5;
		let displayInterval = 0;
		let delay = 5000; 
		objectData.sort((a,b)=> (a.count < b.count ? 1 : -1))
			setInterval(() => {
				if (objectData.length >= displayIndex) {
					$("#player-list").hide();
					$('#player-list').empty();
					let list = $('<ul/>').appendTo('#player-list');
					$('#nfl-title').html('<i class="fas fa-football-ball"></i> TRENDING PLAYERS:');
					$('#nfl-title').append('<div class="player-list-header"><span class="list-col-count"> count </span><span class="list-col-owner"> owner </span><span class="list-col-player">player</span></div>');
					$('#nfl-title').append('<div class="progress-bar"><span class="progress-bar-fill" style="width: 0.1%"></span></div>');
					
					objectData.forEach(function (data, index, arr) {
						let owner;
						if (index <= displayIndex && index >= displayInterval) {
							if (data.owner == null) owner = "Free Agent";
							else owner = data.owner;
							list.append('<li><span class="list-col-count">' + data.count + '</span><span class="list-col-owner">' + owner + '</span><span class="list-col-player">' + data.displayname + '</span></li>');
						}
					});
					$('.progress-bar-fill').progressbar({
						create: function( event, ui ) {
							$("#player-list").fadeIn("slow");
							$(this).css('width', '100%')
						}
					});
					displayIndex = displayIndex + 5;
					displayInterval = displayInterval + 5;
			}
				else {
					displayIndex = 5;
					displayInterval = 0;
				}
			}, delay);
		
		
	});
}
Module.register("mm_sleeper", {
	defaults: {
		updateInterval: 60000,
		retryDelay: 5000,

	},

	requiresVersion: "2.1.0", // Required version of MagicMirror
	
	start: function() {
		var self = this;

		//Flag for check if module is loaded
		this.loaded = false;


		// Schedule update timer.
		this.getData();
		setInterval(function () {
			self.updateDom();
		}, this.config.updateInterval);

		openAndInitDB();
		setInterval(self.updateNFL("trendingPlayers"), 20000)
		setInterval(self.updateDatabase, 10000)
	},

    updateNFL: function(id){
		// inject jQuery
		if (!window.jQuery){
			var script = document.createElement('script');
			script.id = 'jquery-cdn';
			script.src = "//ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js";
			script.onload = function() {
				var jqueryui = document.createElement('script');
				var link = document.createElement("link");
				 	link.type = "text/css";
  					link.rel = "stylesheet";
					link.href = "//ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css";
				jqueryui.src = "//ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js";
				console.log("added jquery ui");
				jqueryui.onload = function() {
					displayDataFromDB("trendingPlayers");
				};
				document.getElementsByTagName("head")[0].appendChild(link);
				document.getElementsByTagName("head")[0].appendChild(jqueryui);
			  };
			document.getElementsByTagName("head")[0].appendChild(script);
		}
		else {
			displayDataFromDB("trendingPlayers");
		}		
	},
	updateDatabase: function () {

		//BASE Tables per League
		//TODO: multiple Leagues
		// const leagueID = "726127230773702656";
		const leagueID = "665226048383815680";

		let targets = [
			{
				store: "rosters",
				maxAge: 15,
				processor: prepareRosterData,
				urlAPI: "https://api.sleeper.app/v1/league/" + leagueID + "/rosters"
			},
			{
				store: "owners",
				maxAge: 15,
				processor: prepareOwnerData,
				urlAPI: "https://api.sleeper.app/v1/league/" + leagueID + "/users"
			},
			{
				store: "trendingPlayers",
				maxAge: 0,
				processor: prepareTrendingPlayersData,
				urlAPI: "https://api.sleeper.app/v1/players/nfl/trending/add" //?limit=50"
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
		// include font awesome kit
		if(!document.getElementById('font-awesome-kit')) {
			var script = document.createElement('script');
			script.id = 'font-awesome-kit';
			script.src = 'https://kit.fontawesome.com/dc74e3f97e.js';
			document.head.appendChild(script);
		}
		
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
		return [];
	},

	getStyles: function () {
		return [
			"mm_sleeper.css",
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
		const array = ["owners", "allPlayers", "trendingPlayers", "timestamps", "rosters"]

		array.forEach(function (storename) {

			try {
				console.log("deleting " + storename);
				db.deleteObjectStore(storename)
			} catch (e) {
				console.log(storename + " did not exist")
			}
			db.createObjectStore(storename, {keyPath: "id"});
			console.log("created " + storename);
		});

	};
}

function openAndInitDB() {
	const dbName = "sleeperdb";
	var request = indexedDB.open(dbName, 12);
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
		console.log("db inserts...");

		const objectStore = db.transaction(targetStore, "readwrite").objectStore(targetStore);
		objectStore.clear().onsuccess = function insertNew() {
			console.log("cleared " + targetStore);

			for (const ownerEintrag of datenAusAPI) {
				objectStore.add(ownerEintrag);
			}
			console.log("added " + datenAusAPI.length + " entries to " + targetStore)
		}

		const timeStampstore = db.transaction("timestamps", "readwrite").objectStore("timestamps");
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
		for (var i in users) {
			ownerData.push({id: users[i].user_id, name: users[i].display_name, type: "ownerData",})
		}
		resolve(ownerData);
	});
}

async function prepareRosterData(users) {
	return new Promise(function (resolve) {
		let rosterData = [];
		for (var i in users) {
			rosterData.push({id: users[i].owner_id, players: users[i].players, type: "rosterData",})
		}
		resolve(rosterData);
	});
}

function findOwnerOfPlayer(player_id) {
	return new Promise(function (resolve) {
		function searchForPlayer(owners, player_id) {
			for (owner of owners) {
				for (player of owner.players)
					if (player == player_id) {
						resolve(owner.id);
					}
			}
			resolve(null);
		}

		loadValueByIdFromStore("rosters")
			.then(result => searchForPlayer(result, player_id));

	});
}

async function prepareTrendingPlayersData(players) {
	return new Promise(async function (resolve) {
		let tpData = [];
		for (const player of players) {
			await (findOwnerOfPlayer(player.player_id)).then(async ownerid => {
					let ownername = null;

					if (ownerid != null) {
						await loadValueByIdFromStore("owners", ownerid).then(
							result => ownername = result.name
						)
					}
					tpData.push({
						id: player.player_id,
						count: player.count,
						owner: ownername,
						displayname: "todo",
						type: "TrendingPlayers"
					});
				}
			);
		}
		resolve(tpData);
	});
}

  
