

define(['models/index'], function (models) {

    var localDB = undefined    

    const request = indexedDB.open("TriggerRally", 2);
    request.onsuccess = event => {
        console.log("opening db")
        localDB = event.target.result
        window.__localDB__ = localDB

        _storeInitialTracks()
    }
    
    request.onupgradeneeded = event => {
        console.log("upgrading db")
        const db = event.target.result;
        if (!db.objectStoreNames.contains("tracks")) {
            db.createObjectStore("tracks", {keyPath: "id"});
        }
        if (!db.objectStoreNames.contains("runs")) {
            db.createObjectStore("runs", {keyPath: "id"});
        }
        if (!db.objectStoreNames.contains("favs")) {
            db.createObjectStore("favs", {keyPath: "id"});
        }
    }

    function _storeInitialTracks(){
        for (var trackId of ['RF87t6b6', 'uUJTPz6M', 'v3base2']) {
            const track = models.Track.findOrCreate(trackId);
            track.fetch({
                success: () => {
                    getStore("tracks", "readwrite").add(track.toJSON());
                }
            })
        }
    }
    
    function getStore(name, mode) {
        if (!localDB){ return }
        const transaction = localDB.transaction(name, mode);
        const tracksStore = transaction.objectStore(name);
        return tracksStore
    }

    function getTrack(trackId, callback) {
        if (!localDB){ return }
        const req = getStore("tracks", "readonly").get(trackId)
        req.onsuccess = () => {
            callback(req.result)
        }
    }

    function storeTrack(track, userId){
        console.log("in store track")
        if (!localDB){ return }
        track = structuredClone(track.toJSON())
        const tracksStore = getStore("tracks", "readwrite")
        const req = tracksStore.get(track.id)
        console.log("storing track")
        req.onsuccess = () => {
            console.log("on success", track)
            
            if (!req.result) {
                console.log("storing 1")
                tracksStore.add(track);
            }
            else if (req.result.published){
                console.log("storing 2")
                window.alert("You already have a published track with the same id")
            }
            else if (req.result.user == userId){
                console.log("storing 3")
                if (window.confirm("Warning: You are about to replace your own track. Are you sure you want to continue?")){
                    tracksStore.put(track);
                }
            }
            else {
                console.log("storing 4")
                if (window.confirm("You already have a track with the same id, do you want to replace it?")){
                    tracksStore.put(track);
                }
            }
        }
    }

    function updateTrack(track){
        if (!localDB){ return }
        track = structuredClone(track.toJSON())
        const tracksStore = getStore("tracks", "readwrite")
        const req = tracksStore.get(track.id)
        req.onsuccess = () => {
            if (!req.result) {
                window.alert("Attempting to update nonexistent track");
                return;
            }
            if (req.result.published) {
                window.alert("Attempting to update published track");
                return;
            }
            tracksStore.put(track);
        }
    }

    // TODO: send deleted tracks (and perhaps even modified tracks) to a recycle bin
    function deleteTrack(trackId){
        if (!localDB){ return }
        const tracksStore = getStore("tracks", "readwrite")
        const req = tracksStore.get(trackId)
        req.onsuccess = () => {
            if (!req.result){
                window.alert("Attempting to delete nonexistent track")
            }
            if (window.confirm(`Are you sure you want to DELETE track "${req.result.name}"? This can't be undone!`)){
                tracksStore.delete(trackId)        
            }
        }    
    }

    function getAllTracks(callback){
        if (!localDB){ return }
        const req = getStore("tracks", "readonly").getAll()
        req.onsuccess = () => {
            callback(req.result)
        }
    }

    function setFavoriteTrack(track, value){
        if (!localDB){ return }
        console.log("setting favorite")
        console.log("exists db?", localDB.objectStoreNames.contains("favs"))
        console.log(track.get('id'), value)

        const favsStore = getStore("favs", "readwrite")
        if (value){
            console.log("making favorite")
            favsStore.put({'id': track.get('id')})
        }
        else {
            console.log("deleting favorite")
            favsStore.delete(track.get('id'))
        }
    }

    function getAllRuns(callback){
        if (!localDB){ return }

        const tx = localDB.transaction("runs", "readonly");
        const store = tx.objectStore("runs");
        console.log("before getAll")
        const req = store.getAll();

        req.onsuccess = () => {
            console.log("I'm in getAllRuns on success")
            callback(req.result)
        }  
        console.log("after getAll")
    }

    function getRun(runId, callback){
        if (!localDB){ return }
        console.log("I'm in get run")
        const runsStore = getStore("runs", "readonly")
        const req = runsStore.get(runId)

        req.onsuccess = () => {
            callback(req.result)
        }  
    }

    function getRuns(trackId, callback){
        if (!localDB){ return }
        
        getAllRuns(runs => {
            runs = runs
                .filter(run => run.track == trackId)
                .sort((a, b) => a.time < b.time ? -1 : 1)
            runs.forEach((run, i) => {
                run.rank = i + 1;
            })
            callback(runs)
        })
    }

    function storeRun(run){
        if (!localDB){ return }
        const runsStore = getStore("runs", "readwrite")
        runsStore.add(run)
    }

    function deleteRun(runId){
        if (!localDB){ return }
        const runsStore = getStore("runs", "readwrite")
        if (window.confirm("delete this run?")){
            runsStore.delete(runId)
        }
        
    }

    function getAllFavs(callback){
        if (!localDB){ return }
        const req = getStore("favs", "readonly").getAll()
        req.onsuccess = () => {
            callback(req.result)
            console.log("all favs\n", req.result)
        }
    }

    function isFav(favId, callback) {
        if (!localDB){ return }
        const req = getStore("favs", "readonly").get(favId)
        req.onsuccess = () => {
            callback(!!req.result)
        }
    }

    return {
        localDB,

        getTrack,
        storeTrack,
        updateTrack,
        deleteTrack,
        getAllTracks,

        setFavoriteTrack,
        getAllFavs,
        isFav,

        getRun,
        getRuns,
        storeRun,
        deleteRun,
        getAllRuns,
    }
})
