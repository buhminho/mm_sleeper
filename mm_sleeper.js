/* global Module */

/* Magic Mirror
 * Module: mm_sleeper
 *
 * By Hanno Buhmes
 * MIT Licensed.
 */
function loadOwnersAndStoreThemToDB(urlApi, self,targetStore, formatterCallback) {
	var retry = true;

	var dataRequest = new XMLHttpRequest();
	dataRequest.open("GET", urlApi, true);
	dataRequest.onreadystatechange = function () {
		console.log(this.readyState);
		if (this.readyState === 4) {
			console.log(this.status);
			if (this.status === 200) {
				const users = JSON.parse(this.response);
				let datenAusAPIReduziert = formatterCallback(users);
				storeDownloadInDB("sleeperdb", targetStore, datenAusAPIReduziert);


				self.processData(JSON.parse(this.response));

			} else if (this.status === 401) {
				self.updateDom(self.config.animationSpeed);
				Log.error(self.name, this.status);
				retry = false;
			} else {
				Log.error(self.name, "Could not load data.");
			}
			if (retry) {
				self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
			}
		}
	};
	return dataRequest;
}

Module.register("mm_sleeper", {
	defaults: {
		updateInterval: 60000,
		retryDelay: 5000,
		
	},

	requiresVersion: "2.1.0", // Required version of MagicMirror
	
	start: function() {
		var self = this;
		var dataRequest = null;
		var dataNotification = null;

		//Flag for check if module is loaded
		this.loaded = false;

		
		// Schedule update timer.
		this.getData();
		setInterval(function() {
			self.updateDom();
		}, this.config.updateInterval);

		setInterval(self.myShit,3000)
	},

    myShit: function(){

	 	this.jsonDB=  [{ fname : "John", lname : "Hancock", value : 49.5 },
					{ fname : "John", lname : "Hancock", value : 95.0 }
					];

		var now = new Date();
		// console.log(now);
		
		// console.log("yeah: " + this.jsonDB[0].fname + "  ");
		
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


		var urlApi = "https://api.sleeper.app/v1/league/726127230773702656/users";
		var dataRequest = loadOwnersAndStoreThemToDB(urlApi, self,"owners", prepareOwnerData);
		dataRequest.send();


		urlApi = "https://api.sleeper.app/v1/players/nfl/trending/add";
		dataRequest = loadOwnersAndStoreThemToDB(urlApi, self,"trendingPlayers", prepareTrendingPlayersData);
		dataRequest.send();
		console.log(dataRequest);
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
		nextLoad = nextLoad ;
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
		var wrapper = document.createElement("div");
			wrapper.className = "player-wrapper";
		var wrapperDataRequest = document.createElement("div");
			wrapperDataRequest.className = "player-data";
		var labelDataRequest = document.createElement("label");
			labelDataRequest.className = "title";
		// create title
			labelDataRequest.innerHTML = '<i class="fas fa-football-ball"></i> Trending Players:';
		wrapper.appendChild(labelDataRequest);
		// create player-list-wrapper
		var playerDataWrapper = document.createElement("div");
			playerDataWrapper.setAttribute("id", "player-list");
		
		var playerList = document.createElement("ul");
			playerDataWrapper.appendChild(playerList);
		// If this.dataRequest is not empty
		if (this.dataRequest) {
			var players = this.dataRequest
			players.forEach(renderProductList);
			function renderProductList(element) {
				console.log(element);
				var li = document.createElement('li');
				li.setAttribute('class','player');
				playerList.appendChild(li);
				li.innerHTML=li.innerHTML + element.player_id; // replace .player_id with .displayname
			}
			// append player-list-wrapper
			wrapper.appendChild(playerDataWrapper);
		}
		
		// Data from helper
		if (this.dataNotification) {
			var wrapperDataNotification = document.createElement("div");
			// translations  + datanotification
			wrapperDataNotification.innerHTML =  this.translate("UPDATE") + ": " + this.dataNotification.date;

			wrapper.appendChild(wrapperDataNotification);
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
		this.dataRequest = data;
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
		const array = ["owners", "allPlayers", "trendingPlayers", "timestamps"]

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

function storeDownloadInDB(dbName,targetStore, datenAusAPI) {

	var request = indexedDB.open(dbName, 7);
	request.onerror = function(event) {
		   window.alert(event)
	};

	request.onupgradeneeded = initializeStores(request);
	

	request.onsuccess = function(){
		const db = request.result;
		console.log("db inserts...");
		const ownerStore = db.transaction(targetStore, "readwrite").objectStore(targetStore);
		for (const ownerEintrag of datenAusAPI) {
			console.log(ownerEintrag);
			ownerStore.add(ownerEintrag);
		}
	}
	 
  }
function prepareOwnerData(users) {
	let ownerData = [];
	for (var i in users) {
		ownerData.push({id: users[i].user_id, name: users[i].display_name})
	}
	return ownerData;
}

function prepareTrendingPlayersData(players) {
	let ownerData = [];
	for (var i in players) {
		ownerData.push({id: players[i].player_id, count: players[i].count, owner: "todo" , displayname: "todo"})
	}
	return ownerData;
}


  
