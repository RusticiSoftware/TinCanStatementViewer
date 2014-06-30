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

//TinCan.enableDebug();

var TINCAN = (TINCAN || {});

TINCAN.Viewer = function () {
    this.log("TINCAN.Viewer constructor");
    var i,
        lrs;

    this.includeRawData = true;
    this.allVersions = ["1.0.0", "0.95", "0.9"];
    this.multiVersionStream = null;
    this.lrses = {};

    if (typeof Config !== "undefined") {
        for (i = 0; i < this.allVersions.length; i += 1) {
            this.log("TINCAN.Viewer version: " + this.allVersions[i]);
            this.lrses[this.allVersions[i]] = new TinCan.LRS (
                {
                    endpoint: Config.endpoint,
                    username: Config.authUser,
                    password: Config.authPassword,
                    version: this.allVersions[i]
                }
            );
        }
    }
};

if (typeof console !== "undefined") {
    TINCAN.Viewer.prototype.log = function (str) {
        console.log(str);
    };
}
else {
    TINCAN.Viewer.prototype.log = function (str) {};
}

TINCAN.Viewer.prototype.getCallback = function (callback) {
    var tcViewer = this;
    return function () { callback.apply(tcViewer, arguments); };
};

TINCAN.Viewer.prototype.getMultiVersionStream = function (versionList) {
    var lrsList = [],
        i;

    for (i = 0; i < versionList.length; i += 1) {
        lrsList.push(this.lrses[versionList[i]]);
    }

    return new TINCAN.MultiLRSStatementStream(lrsList);
};

TINCAN.Viewer.prototype.TinCanSearchHelper = function () {
    this.getVersion = function () {
        return this.getSearchVar("version") || "latest";
    };

    this.getVerb = function () {
        var verbStr = this.getSearchVar(
                this.getVersion().indexOf("0.9") === -1 ? "verb1" : "verb"
            ),
            verb = null
        ;
        if (verbStr !== null && verbStr.length > 0) {
            verb = new TinCan.Verb (verbStr);
        }
        return verb;
    };

    this.getRegistration = function () {
        return this.getSearchVar(this.getVersion().indexOf("0.9") === -1 ? "registration1" : "registration");
    };

    this.getSince = function () {
        var since = this.getSearchVar(this.getVersion().indexOf("0.9") === -1 ? "since1" : "since");
        if (since !== null && !this.dateStrIncludesTimeZone(since)) {
            since = since + "Z";
        }
        return since;
    };

    this.getUntil = function () {
        var until = this.getSearchVar(this.getVersion().indexOf("0.9") === -1 ? "until1" : "until");
        if (until !== null && !this.dateStrIncludesTimeZone(until)) {
            until = until + "Z";
        }
        return until;
    };

    this.getAgent = function () {
        var agent = null,
            agentCfg = {},
            agentProperty = this.getSearchVar("agentProperty"),
            agentValue = this.getSearchVar("agentValue");

        if (agentProperty !== null && agentValue !== null) {
            agentCfg[agentProperty] = agentValue;

            agent = new TinCan.Agent(agentCfg);
        }

        return agent;
    };

    this.getActor = function () {
        var actor = null,
            actorJson = this.getSearchVar("actorJson"),
            actorEmail = this.getSearchVar("actorEmail");

        if (actorJson !== null && actorJson.length > 0) {
            actor = TinCan.Agent.fromJSON(actorJson);
        }
        else if (actorEmail !== null) {
            actor = new TinCan.Agent(
                {
                    mbox: actorEmail
                }
            );
        }

        return actor;
    };

    this.getActivity = function () {
        var activityId = this.getSearchVar("activityId1"),
            activity = null
        ;
        if (activityId !== null && activityId.length > 0) {
            activity = new TinCan.Activity ( { id: activityId } );
        }
        return activity;
    };

    this.getTarget = function () {
        var obj = null,
            objectJson = this.getSearchVar("objectJson"),
            activityId;

        if (objectJson !== null) {
            // TODO: protect JSON.parse
            obj = JSON.parse(objectJson);
            if (typeof obj.objectType === "undefined") {
                // assumed to be activity
                obj.objectType = "Activity";
            }

            if (obj.objectType === "Activity") {
                obj = new TinCan.Activity (obj);
            }
            else if (obj.objectType === "Agent") {
                obj = new TinCan.Agent (obj);
            }
            else if (obj.objectType === "SubStatement") {
                obj = new TinCan.SubStatement (obj);
            }
            else if (obj.objectType === "StatementRef") {
                obj = new TinCan.StatementRef (obj);
            }
        } else {
            activityId = this.getSearchVar("activityId");
            if (activityId !== null) {
                obj = new TinCan.Activity (
                    {
                        id: activityId
                    }
                );
            }
        }

        return obj;
    };

    this.getInstructor = function () {
        var instructorJson = this.getSearchVar("instructorJson"),
            instructor = null;
        if (instructorJson !== null && instructorJson.length > 0) {
            instructor = TinCan.Agent.fromJSON(instructorJson);
        }
        return instructor;
    };

    this.getContext = function () {
        return this.getSearchVarAsBoolean("context", "false");
    };

    this.getAuthoritative = function () {
        return this.getSearchVarAsBoolean("authoritative", "true");
    };

    this.getSparse = function () {
        return this.getSearchVarAsBoolean("sparse", "false");
    };

    this.getFormat = function () {
        return this.getSearchVar("format");
    };

    this.getRelatedAgents = function () {
        return this.getSearchVarAsBoolean("relatedAgents");
    };
    this.getRelatedActivities = function () {
        return this.getSearchVarAsBoolean("relatedActivities");
    };
    this.getAttachments = function () {
        return this.getSearchVarAsBoolean("attachments");
    };

    this.dateStrIncludesTimeZone = function (str) {
        return typeof str !== "undefined" && (str.indexOf("+") >= 0 || str.indexOf("Z") >= 0);
    };

    this.getSearchVar = function (searchVarName, defaultVal) {
        var myVar = $("#"+searchVarName).val();
        if (myVar === null || myVar.length < 1) {
            if (typeof defaultVal !== "undefined") {
                return defaultVal;
            }
            return null;
        }
        return myVar;
    };

    this.getSearchVarAsBoolean = function (searchVarName, defaultVal) {
        return $("#"+searchVarName).is(":checked");
    };
};

TINCAN.Viewer.prototype.TinCanFormHelper = function () {
    this.copyQueryStringToForm = function () {
        var booleanVals = ["context", "authoritative", "sparse"];
        var qsMap = this.getQueryStringMap();
        for (var key in qsMap) {
            var inputType = ($.inArray(key, booleanVals) >= 0) ? "checkbox" : "text";
            this.setInputFromQueryString(key, qsMap[key], inputType);
            this.setInputFromQueryString(key+"1", qsMap[key], inputType); //For 1.0.0 form fields
        }
    };

    this.setInputFromQueryString = function (name, val, inputType) {
        if (inputType === null) {
            inputType = "text";
        }
        if (val !== null) {
            if (inputType === "text") {
                $("#"+name).val(val);
            }
            else if (inputType === "checkbox"){
                if (val === "true") {
                    $("#"+name).attr('checked', 'checked');
                } else {
                    $("#"+name).removeAttr('checked');
                }
            }
        }
    };

    this.getQueryStringMap = function () {
        var qs = window.location.search,
            nameVals,
            qsMap,
            i,
            keyVal;
        if (qs === null || qs.length < 1){
            return [];
        }
        if (qs.indexOf("#") > 0){
            qs = qs.substring(0, qs.indexOf("#"));
        }
        qs = qs.substring(1, qs.length);
        nameVals = qs.split("&");
        qsMap = {};
        for (i = 0; i < nameVals.length; i += 1) {
            keyVal = nameVals[i].split("=");
            qsMap[keyVal[0]] = decodeURIComponent(keyVal[1].replace(/\+/g, " "));
        }
        return qsMap;
    };
};

TINCAN.Viewer.prototype.commonQueryObj = function (helper) {
    var queryObj = {},
        verb = helper.getVerb(),
        registration = helper.getRegistration(),
        since = helper.getSince(),
        until = helper.getUntil();

    if (verb !== null) {
        queryObj.verb = verb;
    }
    if (registration !== null) {
        queryObj.registration = registration;
    }
    if (since !== null) {
        queryObj.since = since;
    }
    if (until !== null) {
        queryObj.until = until;
    }

    return queryObj;
};

TINCAN.Viewer.prototype.pre1QueryObj = function (helper) {
    var queryObj = this.commonQueryObj(helper),
        actor = helper.getActor(),
        target = helper.getTarget(),
        instructor = helper.getInstructor(),
        context = helper.getContext(),
        sparse = helper.getSparse(),
        authoritative = helper.getAuthoritative();

    if (actor !== null) {
        queryObj.actor = actor;
    }
    if (target !== null) {
        queryObj.target = target;
    }
    if (instructor !== null) {
        queryObj.instructor = instructor;
    }
    if (context !== null) {
        queryObj.context = context;
    }
    if (sparse !== null) {
        queryObj.sparse = sparse;
    }
    if (authoritative !== null) {
        queryObj.authoritative = authoritative;
    }

    return queryObj;
};

TINCAN.Viewer.prototype.v1QueryObj = function (helper) {
    var queryObj = this.commonQueryObj(helper),
        agent = helper.getAgent(),
        activity = helper.getActivity(),
        format = helper.getFormat(),
        relatedAgents = helper.getRelatedAgents(),
        relatedActivities = helper.getRelatedActivities(),
        attachments = helper.getAttachments();

    if (agent !== null) {
        queryObj.agent = agent;
    }
    if (activity !== null) {
        queryObj.activity = activity;
    }
    if (format !== null) {
        queryObj.format = format;
    }
    if (relatedAgents !== null) {
        queryObj.related_agents = relatedAgents;
    }
    if (relatedActivities !== null) {
        queryObj.related_activities = relatedActivities;
    }
    // TODO: TinCanJS doesn't yet parse multipart
    //if (attachments !== null) {
        //queryObj.attachments = attachments;
    //}

    return queryObj;
};

TINCAN.Viewer.prototype.searchStatements = function () {
    var selectVersion,
        versionsToUse,
        helper = new this.TinCanSearchHelper(),
        queryObj,
        requestResult,
        prop,
        url,
        urlPairs = [];

    selectVersion = helper.getVersion();

    if (selectVersion === "0.9" || selectVersion === "0.95" || selectVersion === "0.95 + 0.9") {
        queryObj = this.pre1QueryObj(helper);
    }
    else {
        queryObj = this.v1QueryObj(helper);
    }

    queryObj.limit = 25;

    // Figure out the versions to use
    if (selectVersion === "latest") {
        versionsToUse = [ this.allVersions[0] ];
    } else if (selectVersion === "0.95 + 0.9") {
        versionsToUse = [ "0.95", "0.9" ];
    } else {
        versionsToUse = [ selectVersion ];
    }

    this.multiVersionStream = this.getMultiVersionStream(versionsToUse);
    requestResult = this.multiVersionStream.loadStatements(queryObj, this.getCallback(this.statementsFetched));

    if (requestResult.config && requestResult.config.params) {
        // Set the TCAPI query text
        for (prop in requestResult.config.params) {
            urlPairs.push(prop + "=" + encodeURIComponent(requestResult.config.params[prop]));
        }
        url = this.lrses[versionsToUse[0]].endpoint + requestResult.config.url + "?" + urlPairs.join("&");
    }
    else {
        url = "Invalid URL: " + requestResult.err;
    }
    $("#TCAPIQueryText").text(url);
};

TINCAN.Viewer.prototype.getMoreStatements = function (callback) {
    this.multiVersionStream.loadStatements("more", this.getCallback(this.statementsFetched));
};

TINCAN.Viewer.prototype.statementsFetched = function (multiStream) {
    var unwiredDivs;

    // If this query led no where, show no statements available method
    if (multiStream.exhausted()) {
        $("#statementsLoading").hide();
        $("#noStatementsMessage").show();
    }

    // Alright, render all available statements
    $("#statementsLoading").hide();
    $("#theStatements").append(
        this.renderStatements(
            multiStream.getAllStatements()
        )
    );

    // Hook up the "show raw data" links
    unwiredDivs = $('div[tcid].unwired');
    unwiredDivs.click(function () {
        $('[tcid_data="' + $(this).attr('tcid') + '"]').toggle();
    });
    unwiredDivs.removeClass('unwired');

    // Show more button?
    $("#showAllStatements").toggle(!multiStream.exhausted());
};

TINCAN.Viewer.prototype.escapeHTML = function (text) {
    var html = text + "";
    return html.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
};

TINCAN.Viewer.prototype.renderActor = function (actor) {
    return this.escapeHTML(actor);
};

TINCAN.Viewer.prototype.renderStatements = function (statements) {
    var allStmtStr,
        i,
        dt,
        aDate,
        stmtStr,
        stmt,
        verb,
        objDesc,
        answer,
        activityType;


    function truncateString (str, length) {
        if (str === null || str.length < 4 || str.length <= length) {
            return str;
        }
        return str.substr(0, length - 3) + '...';
    }

    function getResponseText (stmt) {
        var response,
            objDef,
            componentName = null,
            components,
            responses,
            responseStr = [],
            first = true,
            responseId,
            i,
            j,
            source,
            target,
            responseParts;

        if (stmt.result === null || stmt.result.response === null) {
            return "";
        }
        response = stmt.result.response;

        if (stmt.target === null ||
            stmt.target.objectType !== "Activity" ||
            stmt.target.definition === null ||
            stmt.target.definition.type !== "cmi.interaction" ||
            stmt.target.definition.interactionType === null
        ) {
            return response;
        }
        objDef = stmt.target.definition;

        // TODO: move the splitting on [,] of the values into TinCanJS
        if (objDef.interactionType === "matching") {
            if (objDef.source !== null &&
                objDef.source.length > 0 &&
                objDef.target !== null &&
                objDef.target.length > 0
            ) {
                source = objDef.source;
                target = objDef.target;

                responses = response.split("[,]");

                for (i = 0; i < responses.length; i += 1) {
                    responseParts = responses[i].split("[.]");

                    for (j = 0; j < source.length; j += 1) {
                        if (responseParts[0] === source[j].id) {
                            if (!first) {
                                responseStr.push(", ");
                            }
                            responseStr.push(source[j].getLangDictionaryValue("description"));
                            first = false;
                        }
                    }
                    for (j = 0; j < target.length; j += 1) {
                        if (responseParts[1] === target[j].id) {
                            responseStr.push(" -> ");
                            responseStr.push(target[j].getLangDictionaryValue("description"));
                        }
                    }
                }
            }
        } else {
            if (objDef.interactionType === "choice" || objDef.interactionType === "sequencing") {
                componentName = "choices";
            }
            else if (objDef.interactionType === "likert") {
                componentName = "scale";
            }
            else if (objDef.interactionType === "performance") {
                componentName = "steps";
            }

            if (componentName !== null) {
                components = objDef[componentName];

                if (components !== null && components.length > 0){
                    responses = response.split("[,]");

                    for (i = 0; i < responses.length; i += 1) {
                        for (j = 0; j < components.length; j += 1) {
                            responseId = responses[i];
                            if (objDef.interactionType === "performance"){
                                responseId = responses[i].split("[.]")[0];
                            }
                            if (responseId === components[j].id) {
                                if (!first) {
                                    responseStr.push(", ");
                                }
                                responseStr.push(components[j].getLangDictionaryValue("description"));

                                if (objDef.interactionType === "performance") {
                                    responseStr.push(" -> ");
                                    responseStr.push(responses[i].split("[.]")[1]);
                                }
                                first = false;
                            }
                        }
                    }
                }
            }
        }

        if (responseStr.length > 0) {
            return responseStr.join("");
        }

        return response;
    }

    allStmtStr = [];
    allStmtStr.push("<table>");

    for (i = 0; i < statements.length; i += 1) {
        stmtStr = [];
        stmt = statements[i];
        //this.log("-------------------------------" + stmt.id + "-------------------------------");

        stmtStr.push("<tr class='statementRow'>");
        stmtStr.push("<td class='date'><div class='statementDate'>" + (stmt.stored !== null ? stmt.stored.replace('Z','') : "") + "</div></td>");
        stmtStr.push("<td>");
        stmtStr.push("<div class='statement unwired' tcid='" + stmt.id + "'>");

        try {
            stmtStr.push(
                "<span class='actor'>" + 
                    (stmt.actor !== null ? this.renderActor(stmt.actor) : "No Actor") + 
                "</span> ");

            if (stmt.context !== null &&
                stmt.context.extensions !== null &&
                typeof stmt.context.extensions.verb !== "undefined"
            ) {
                verb = stmt.context.extensions.verb;
            } else {
                verb = stmt.verb + "";
            }

            if (verb === "interacted") {
                verb = "interacted with";
            } else if (stmt.inProgress === true) {
                verb = verb + " (in progress)";
            }

            answer = null;

            if (typeof stmt.target.definition !== "undefined" && stmt.target.definition !== null) {
                activityType = stmt.target.definition.type;
                if (activityType !== null && (activityType === "question" || activityType.indexOf("interaction") >= 0)) {
                    if (stmt.result !== null) {
                        if (stmt.result.success !== null) {
                            verb = (stmt.result.success ? "correctly " : "incorrectly ") + verb;
                        }
                        if (stmt.result.response !== null) {
                            answer = " with response '" + this.escapeHTML(truncateString(getResponseText(stmt), 30)) + "' ";
                        }
                    }
                }
            }

            stmtStr.push(" <span class='verb'>" + this.escapeHTML(verb) + "</span> ");
            stmtStr.push(" <span class='object'>'" + this.escapeHTML(stmt.target) + "'</span> ");
            stmtStr.push(answer !== null ? answer : "");

            if (stmt.result !== null && stmt.result.score !== null) {
                if (stmt.result.score.scaled !== null) {
                    stmtStr.push(" with score <span class='score'>" + Math.round((stmt.result.score.scaled * 100.0)) + "%</span>");
                } else if (stmt.result.score.raw !== null) {
                    stmtStr.push(" with score <span class='score'>" + stmt.result.score.raw + "</span>");
                }
            }
        }
        catch (error) {
            this.log("Error occurred while trying to display statement with id " + stmt.id + ": " + error.message);
            //this.log("-------------------------------" + stmt.id + "-------------------------------");
            stmtStr.push("<span class='stId'>" + stmt.id + "</span>");
        }
        stmtStr.push("</div>");

        if (this.includeRawData) {
            stmtStr.push("<div class='tc_rawdata' tcid_data='" + stmt.id + "'>");
            stmtStr.push("<pre>" + stmt.originalJSON + "</pre>");
            stmtStr.push("</div>");
        }

        stmtStr.push("</td></tr>");
        allStmtStr.push(stmtStr.join(''));
        //this.log("-------------------------------" + stmt.id + "-------------------------------");
    }
    allStmtStr.push("</table>");

    return allStmtStr.join('');
};

TINCAN.Viewer.prototype.pageInitialize = function () {
    var tcViewer = this,
        doRefresh = function () {
            $("#statementsLoading").show();
            $("#showAllStatements").hide();
            $("#noStatementsMessage").hide();
            $("#theStatements").empty();
            tcViewer.searchStatements();
        };

    $.datepicker.setDefaults(
        {
            dateFormat: "yy-mm-dd",
            constrainInput: false
        }
    );
    $("#since").datepicker();
    $("#until").datepicker();
    $("#since1").datepicker();
    $("#until1").datepicker();

    $("#statementsLoading").show();
    $("#showAllStatements").hide();
    $("#noStatementsMessage").hide();

    $("#refreshStatements").click(doRefresh);

    $("#showAllStatements").click(
        function () {
            $("#statementsLoading").show();
            tcViewer.getMoreStatements();
        }
    );

    $("#version").change(
        function (e) {
            var version = $(e.target.options[e.target.selectedIndex]).val(),
                searchBoxTable = $("#searchBoxTable"),
                advancedSearchTable = $("#advancedSearchTable"),
                searchBoxTable1 = $("#searchBoxTable1"),
                advancedSearchTable1 = $("#advancedSearchTable1");

            if (version === "0.9" || version === "0.95" || version === "0.95 + 0.9") {
                if (searchBoxTable1.is(":visible")) {
                    searchBoxTable1.toggle("slow");
                    searchBoxTable.toggle("slow");

                    if (advancedSearchTable1.is(":visible")) {
                        advancedSearchTable1.toggle("slow");
                        advancedSearchTable.toggle("slow");
                    }
                }
            }
            else {
                if (searchBoxTable.is(":visible")) {
                    searchBoxTable.toggle("slow");
                    searchBoxTable1.toggle("slow");

                    if (advancedSearchTable.is(":visible")) {
                        advancedSearchTable.toggle("slow");
                        advancedSearchTable1.toggle("slow");
                    }
                }
            }

            doRefresh();
        }
    );

    $("#showAdvancedOptions").click(
        function () {
            var version = $("#version").val(),
                node;

            if (version === "0.9" || version === "0.95" || version === "0.95 + 0.9") {
                node = $("#advancedSearchTable");
            }
            else {
                node = $("#advancedSearchTable1");
            }

            node.toggle(
                'slow',
                function () {
                    var visible = node.is(":visible"),
                        text = (visible ? "Hide" : "Show") + " Advanced Options";

                    $("#showAdvancedOptions").html(text);
                }
            );
        }
    );

    $("#showQuery").click(
        function () {
            $("#TCAPIQuery").toggle(
                'slow',
                function () {
                    var visible = $("#TCAPIQuery").is(":visible"),
                        text = (visible ? "Hide" : "Show") + " TCAPI Query";
                    $("#showQuery").html(text);
                }
            );
        }
    );

    (new this.TinCanFormHelper()).copyQueryStringToForm();
};
