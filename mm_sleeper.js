/* global Module */

/* Magic Mirror
 * Module: mm_sleeper
 *
 * By Hanno Buhmes
 * MIT Licensed.
 */

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

		var urlApi = "https://api.sleeper.app/v1/league/726127230773702656/users";
		var retry = true;

		var dataRequest = new XMLHttpRequest();
		dataRequest.open("GET", urlApi, true);
		dataRequest.onreadystatechange = function() {
			console.log(this.readyState);
			if (this.readyState === 4) {
				console.log(this.status);
				if (this.status === 200) {
					const users = JSON.parse(this.response);
					if (databaseExists("sleeperdb", function (yesno) {
						if( yesno ) {
							
						}
						else {
							writeStateToIndexedDB("users", users);
						}
					  }));
					self.processData(JSON.parse(this.response));
					if (window.indexedDB) {
						console.log("Ihr Browser unterstützt IndexedDB");
					}
					/*
					if (databaseExists("sleeperdb", function (yesno) {
	
						if( yesno ) {
							console.log("Datenbank nicht verfügbar")
						}
						else {
						  console.log("Datenbank nicht verfügbar")
						}
					  }));
					  */
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
		dataRequest.send();
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

		// create element wrapper for show into the module
		var wrapper = document.createElement("div");
		// If this.dataRequest is not empty
		if (this.dataRequest) {
			var wrapperDataRequest = document.createElement("div");
			// check format https://jsonplaceholder.typicode.com/posts/1
			wrapperDataRequest.innerHTML = this.dataRequest.title;

			var labelDataRequest = document.createElement("label");
			// Use translate function
			//             this id defined in translations files
			labelDataRequest.innerHTML = this.translate("TITLE");


			wrapper.appendChild(labelDataRequest);
			wrapper.appendChild(wrapperDataRequest);
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
// IndexedDB
function writeStateToIndexedDB(storename, datenAusAPI) {
	databaseExists("sleeperdb", function (yesno) {
	 
	
		const dbName = "sleeper";
		var request = indexedDB.open(dbName, 2);
		request.onerror = function(event) {
		   window.alert(event)
		};
		let ownerData = [];
		for (var i in datenAusAPI) {
			ownerData.push({id: datenAusAPI[i].user_id, name:datenAusAPI[i].display_name})
		}
		request.onupgradeneeded = function(event) {
		   var db = event.target.result;
		   var objectStore = db.createObjectStore("owners", { keyPath: "id" });
		   //objectStore.createIndex("id", "id", { unique: true });
		   for (var i in ownerData) {
			  console.log(ownerData[i]);
			  objectStore.add(ownerData[i]);
		  }
	    }; 
	
	});      
  }
  function readStateFromIndexedDB(storename, arrayname, key_term, value_term) {
	if (databaseExists("sleeperdb", function (yesno) {
	  if( yesno ) { sleeperdb
	  var request = window.indexedDB.open("sleeperdb", 2);
	  request.onsuccess = function (event) 
	  {
		db = request.result;
		console.log('The database is opened successfully');
  
		db.transaction(storename).objectStore(storename).get(arrayname).onsuccess = function(event) {
		  $("#container").append(filter_players(event.target.result.state), key_term, value_term);
		};
		return true;
	  }
	  request.onerror = function (event) {
		console.log("Keine Verbindung zur IndexedDB hergestellt");
		return false;
	  }
	}
	})
	) return true;
	else return false;
	sleeperdb
   
	
  }
  function databaseExists(dbname, callback) {
	var req = indexedDB.open(dbname);
	var existed = true;
	req.onsuccess = function () {
		req.result.close();
		if (!existed)
			indexedDB.deleteDatabase(dbname);
		callback(existed);
	}
	req.onupgradeneeded = function () {
		existed = false;
	}
  }
  function deleteIndexedDB() {
	databaseExists("sleeperdb", function (yesno) {
	  if( yesno ) { 
		var req = indexedDB.deleteDatabase("sleeperdb");
		req.onsuccess = function () {
		  console.log("Deleted database successfully");
		};
		req.onerror = function () {
		  console.log("Couldn't delete database");
		};
		req.onblocked = function () {
		  console.log("Couldn't delete database due to the operation being blocked");
		};
	  }
	  });
  }