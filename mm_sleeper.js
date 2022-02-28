/* global Module */

/* Magic Mirror
 * Module: mm_sleeper
 *
 * By Hanno Buhmes
 * MIT Licensed.
 */
function loadOwnersAndStoreThemToDB(urlApi, self,targetStore, formatterCallback) {
	var retry = true;
	console.log("handle: " + targetStore);
	let responsePromise = fetch(urlApi);
	responsePromise.then(async function (response) {
		console.log(response.status);

		if (response.status === 200) {
			await response.json().then(function (dataFromAPI) {

				let datenAusAPIReduziert = formatterCallback(dataFromAPI);
				storeDownloadInDB(targetStore, datenAusAPIReduziert);


				self.processData(dataFromAPI);
			});
		} else if (response.status === 401) {
			self.updateDom(self.config.animationSpeed);
			Log.error(self.name, response.status);
			retry = false;
		} else {
			Log.error(self.name, "Could not load data.");
		}
		if (retry) {
			self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
		}

	});

	return responsePromise;
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
		loadOwnersAndStoreThemToDB(urlApi, self, "owners", prepareOwnerData).then(function () {
				urlApi = "https://api.sleeper.app/v1/players/nfl/trending/add";
				loadOwnersAndStoreThemToDB(urlApi, self, "trendingPlayers", prepareTrendingPlayersData).then(function () {
						console.log("resultchecks...")
						let valueByIdFromStorePromise = loadValueByIdFromStore("owners");
						valueByIdFromStorePromise.then(function(data){console.log(data)});

					});
			}
		);

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

		var wrapper = document.createElement("div");

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

function openAndInitDB(dbName) {
	var request = indexedDB.open(dbName, 7);
	request.onerror = function (event) {
		window.alert(event)
	};

	request.onupgradeneeded = initializeStores(request);
	return request;
}

function storeDownloadInDB(targetStore, datenAusAPI) {

	const dbName = "sleeperdb";
	var request = openAndInitDB(dbName);

	request.onsuccess = function () {
		const db = request.result;
		console.log("db inserts...");
		const objectStore = db.transaction(targetStore, "readwrite").objectStore(targetStore);
		for (const ownerEintrag of datenAusAPI) {
			console.log(ownerEintrag);
			objectStore.add(ownerEintrag);
		}
		const timeStampstore = db.transaction("timestamps", "readwrite").objectStore("timestamps");
		timeStampstore.add({id: targetStore, ts: Date.now()})
	}

}

function loadValueByIdFromStore(targetStore, lookupid) {
	const dbName = "sleeperdb";

	return new Promise(function(resolve, reject) {
		var request = openAndInitDB(dbName);

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
		}

	});

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


  
