/*
   Copyright 2012 Rustici Software, LLC

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

var TINCAN = (TINCAN || {});

// An object to help construct Tin Can statement queries
TINCAN.StatementQueryObject = function () {
    this.verb = null;
    this.object = null;
    this.registration = null;
    this.context = false;
    this.actor = null;
    this.since = null;
    this.until = null;
    this.limit = 0;
    this.authoritative = true;
    this.sparse = false;
    this.instructor = null;
};
TINCAN.StatementQueryObject.prototype = {
    toString: function () {
        var qs = [],
            key,
            val;

        for (key in this) {
            if (this.hasOwnProperty(key)) {
                val = this[key];
                if (val === null || typeof val === "function") {
                    continue;
                }
                if (typeof val === "object") {
                    val = JSON.stringify(val);
                }
                qs.push(key + "=" + encodeURIComponent(val));
            }
        }
        return qs.join("&");
    },

    // TODO: TinCanJS does this for us?
    //       put these on the prototype if they are kept
    upConvertActor: function (actor) {
        var converted = null;
        if (actor !== null) {
            converted = {};
            if (actor.mbox !== null && typeof actor.mbox !== "string") {
                converted.mbox = actor.mbox[0];
            }
            if (actor.account !== null && typeof actor.account[0] !== "undefined") {
                converted.account = {
                    homePage: actor.account[0].accountServiceHomePage,
                    name: actor.account[0].accountName
                };
            }
        }
        return converted;
    },

    // TODO: TinCanJS does this for us?
    //       put these on the prototype if they are kept
    converted: function (version) {
        var obj = this,
            k;
        if (version !== "0.9") {
            obj = {};
            for (k in this) {
                if (this.hasOwnProperty(k)) {
                    obj[k] = this[k];
                }
            }
            obj.actor = this.upConvertActor(obj.actor);
            obj.instructor = this.upConvertActor(obj.instructor);
        }
        return obj;
    }
};

//
// Using the given lrsList, this object will fetch from many LRSs
// and allow consumers to process those statements by descending stored
// date, respecting order across the many LRSs
//
TINCAN.MultiLrsStatementStream = function (lrsList) {
    this.lrsList = lrsList;
    this.state = {};

    this.initializeState();
};
TINCAN.MultiLrsStatementStream.prototype = {
    getLrsId: function (lrs) {
        return lrs.endpoint + lrs.auth + lrs.version;
    },

    initializeState: function () {
        var i, lrs;
        for (i = 0; i < this.lrsList.length; i += 1) {
            lrs = this.lrsList[i];
            this.state[this.getLrsId(lrs)] = {
                lrs: lrs,
                statements: [],
                moreUrl: null
            };
        }
    },

    getIdMap: function () {
        var k, ids = {};
        for (k in this.state) {
            if (this.state.hasOwnProperty(k)) {
                ids[k] = true;
            }
        }
        return ids;
    },

    // Returns the next statement from the given statement streams based
    // on most recent stored date.
    getNextStatement: function () {
        var lrsId, lrsState, recentStatement, maxDate = "0", nextLrsId;

        for (lrsId in this.getIdMap()) {
            lrsState = this.state[lrsId];

            // We have to stop giving statements here because the most recent
            // statement could be one we haven't yet fetched
            if (lrsState.statements.length === 0 && lrsState.moreUrl !== null) {
                return null;
            }
            if (lrsState.statements.length > 0) {
                recentStatement = lrsState.statements[0];
                if (recentStatement.stored.localeCompare(maxDate) > 0) {
                    maxDate = recentStatement.stored;
                    nextLrsId = lrsId;
                }
            }
        }
        return (nextLrsId === null) ? null : this.state[nextLrsId].statements.shift();
    },

    // Use getNextStatement to get all loaded statements that can be
    // guaranteed to be in order
    getAllStatements: function () {
        var stmt, statements = [];
        stmt = this.getNextStatement();
        while (stmt !== null) {
            statements.push(stmt);
            stmt = this.getNextStatement();
        }
        return statements;
    },

    // Load statements from multiple LRSs, and call the given callback when
    // those statements are ready passing in this multi stream object as the argument
    loadStatements: function (queryObj, callback) {
        var multiStream = this,
            isMoreQuery = (queryObj === "more"),
            lrsListToUse = this.lrsList,
            lrsId,
            lrsState,
            i,
            callbackCount,
            createCallback,
            url,
            versionHeader;

        if (isMoreQuery) {
            // If we're continuing some query, only query lrs's that have more statements
            lrsListToUse = [];
            for (lrsId in this.getIdMap()) {
                lrsState = this.state[lrsId];
                if (lrsState.statements.length <= 10 && lrsState.moreUrl !== null) {
                    lrsListToUse.push(this.state[lrsId].lrs);
                }
            }
        } else {
            // If this is not a continuation query, make sure to reset moreUrls
            this.initializeState();
        }

        // Capture total count of lrs's to help w/ multiple callbacks below
        callbackCount = lrsListToUse.length;

        // Setup a function which will create a callback for this lrs fetch
        createCallback = function (lrsId) {
            return function (stResult) {
                console.log("createCallback - in callback: " + stResult);
                var streamState = multiStream.state[lrsId];

                // Capture this lrs's statements into state, note more url
                Array.prototype.push.apply(streamState.statements, stResult.statements);
                streamState.moreUrl = stResult.more;

                // Only do handed in callback after all versions done
                callbackCount--;
                if (callbackCount === 0) {
                    callback(multiStream);
                }
            };
        };

        // Loop through the lrs's, setting up callbacks and fetching statements
        for (i = 0; i < lrsListToUse.length; i += 1) {
            // Get reference to lrs we're using
            lrs = lrsListToUse[i];
            lrsId = this.getLrsId(lrs);

            if (!isMoreQuery) {
                lrs.queryStatements(
                    {
                        params: queryObj,
                        callback: createCallback(lrsId)
                    }
                );
            } else {
                lrs.moreStatements(
                    {
                        callback: createCallback(lrsId)
                    }
                );
            }
        }
    },

    // Load more statements from the saved multiple LRSs and current query
    // started with loadStatements. Call callback when statements are ready,
    // passing in this multi stream object as the argument
    loadMoreStatements: function (callback) {
        this.loadStatements("more", callback);
    },

    // Returns true if there are no more statements available, whether fetched
    // or potentially available through a continuation query (i.e. "more" url)
    exhausted: function () {
        var lrsId, lrsState;
        for (lrsId in this.getIdMap()) {
            lrsState = this.state[lrsId];
            if (lrsState.statements.length > 0 || lrsState.moreUrl !== null) {
                return false;
            }
        }
        return true;
    }
};
