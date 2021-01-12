// ==UserScript==
// @id          Atomic_PGN_Downloader@https://github.com/ChronoMonochrome/UserScripts
// @name        Atomic PGN Downloader
// @namespace   https://github.com/ChronoMonochrome/UserScripts
// @description An addon for chess.com to download Atomic chess variant PGNs and convert to Lichess compatible format
// @version     0.1.3
// @author      Chrono
// @copyright   2021+, Victor Shilin aka Chrono
// @license     MIT
// @downloadURL https://raw.githubusercontent.com/ChronoMonochrome/UserScripts/master/Atomic_PGN_Downloader.user.js
// @updateURL   https://raw.githubusercontent.com/ChronoMonochrome/UserScripts/master/Atomic_PGN_Downloader.user.js
// @supportURL  https://github.com/ChronoMonochrome/UserScripts/issues
// @match       https://www.chess.com/variants/atomic/game/*
// @match       https://chess.com/variants/atomic/game/*
// @run-at      document-end
// @grant       none
// @icon        https://raw.githubusercontent.com/ornicar/lila/7ae3ce605f2e828f14afb4c99275b7867dba5ae5/public/logo/lichess-favicon-32-invert.png
// ==/UserScript==

(function () {

  function getPlayersStats() {
    var players = document.getElementsByClassName("gameover-standings-standing");
    var playerColors = document.getElementsByClassName("gameover-standings-box-f");

    if (!players || !playerColors)
      return;

    if (players.length < 2 || playerColors.length < 2)
      return;

    var buf = "";
    var tmpRes = [];
    var res = [];
    for (var i = 0; i < players.length; i++) {
      var s = players[i].textContent;
      for (var j = 0; j < s.length - 1; j++) {
        if ([" ", "(", ")"].includes(s[j]))
          continue;
        buf += s[j];
      }
      buf = buf.split(/\r?\n/);
      for (j = 0; j < buf.length; j++) {
        if (buf[j] == "") {
          continue;
        }

        tmpRes.push(buf[j]);
      }

      if (tmpRes.length == 3)
        res.push(tmpRes);
      tmpRes = [];
      buf = ""
    }

    if (res.length < 2)
      return;

    var playerStats = [];
    for (i = 0; i < res.length; i++) {
      var playerStat = {};
      playerStat.name = res[i][0];
      playerStat.elo = res[i][1];
      playerStat.ratingDiff = res[i][2];
      playerStats.push(playerStat);
    }

    var color = playerColors[0].getAttribute("style")

    if (color == "background-color: rgb(184, 184, 184);") {
      playerStats[0].color = "White";
      playerStats[1].color = "Black";
    }
    else if (color == "background-color: rgb(94, 93, 93);") {
      playerStats[0].color = "Black";
      playerStats[1].color = "White";
    }

    return playerStats;
  }

  function getTimeControl() {
    var header = document.getElementsByClassName("board-panel-panel-header");
    if (!header)
      return;

    var lst = header[0].textContent.split(/\r?\n/);
    var buf = "";
    var flag = false;
    for (var i = 0; i < lst.length; i++) {
      for (var j = 0; j < lst[i].length; j++) {
        if (lst[i][j] != " ") {
          flag = true;
          buf += lst[i][j];
        }
      }
      if (flag) {
        break;
      }
    }

    if (!buf)
      return;

    buf = buf.split("");

    if (buf.length != 3)
      return;

    if (buf[1] != "|")
      return;

    var seconds, increment;
    try {
      seconds = parseInt(buf[0]) * 60;
      increment = parseInt(buf[2])
    }
    catch {}

    return `${seconds}+${increment}`;
  }

  function getPGN() {
    var table = document.getElementsByClassName("moves-table");

    if (!table)
      return;

    table = table[0];

    if (!table)
      return;

    var pgnRaw = table.textContent;
    if (!pgnRaw)
      return;

    var termIdx;
    var termResult;

    for (var i = pgnRaw.length; i > 0; i--) {
      if (["D", "R", "S", "T", "#"].includes(pgnRaw[i]) && pgnRaw[i + 1] == " ") {
        termIdx = i;
        termResult = pgnRaw[termIdx];
        if (pgnRaw[i] == "#") {
          termIdx = i + 2;
        }
        break;
      }
    }

    var threefoldMsg = "Game over (threefold repetition)";

    if (pgnRaw.includes(threefoldMsg)) {
      pgnRaw = pgnRaw.substring(0, pgnRaw.length - threefoldMsg.length);
      termResult = "D";
    }

    var pgn = pgnRaw;

    if (termIdx) {
      pgn = pgn.slice(0, termIdx - 1);
    }

    var termColorIdx;
    var termColor;

    for (i = pgn.length - 1; i > 0; i--) {
      var c = pgn[i];

      c = c.charCodeAt();
      if (![10, 32].includes(c)) {
        termColor = "Black";
        termColorIdx = i - 1;
        break;
      }

      if (c == 10) {
        termColor = "White";
        termColorIdx = i - 1;
        break;
      }
    }

    var pgnStruct = {};

    var playerStats = getPlayersStats();

    pgnStruct.pgn = pgn;
    pgnStruct.termIdx = termIdx;
    pgnStruct.termResult = termResult;
    pgnStruct.termColorIdx = termColorIdx;
    pgnStruct.termColor = termColor;

    return pgnStruct;
  }

  function getPGNStr() {
    var gameUrl, date, white, black, whiteElo, blackElo,
      whiteRatingDiff, blackRatingDiff, result, timeControl;

    gameUrl = window.location.href;
    var pgn = getPGN();
    var playerStats = getPlayersStats();

    if (!pgn || !playerStats)
      return;

    if (!playerStats[0].color || !playerStats[1].color)
      return;

    var whiteColorIdx, blackColorIdx;
    if (playerStats[0].color == "White") {
      whiteColorIdx = 0;
      blackColorIdx = 1;
    }
    else {
      whiteColorIdx = 1;
      blackColorIdx = 0;
    }

    white = playerStats[whiteColorIdx].name;
    whiteElo = playerStats[whiteColorIdx].elo;
    whiteRatingDiff = playerStats[whiteColorIdx].ratingDiff;
    black = playerStats[blackColorIdx].name;
    blackElo = playerStats[blackColorIdx].elo;
    blackRatingDiff = playerStats[blackColorIdx].ratingDiff;

    if (["T", "R"].includes(pgn.termResult)) {
      if (pgn.termColor == "White")
        result = "0-1";
      else
        result = "1-0";
    }
    else if (["D", "S"].includes(pgn.termResult)) {
      result = "1/2-1/2";
    }
    else if (pgn.termResult == "#") {
      if (pgn.termColor == "White")
        result = "1-0";
      else
        result = "0-1";
    }

    timeControl = getTimeControl();

    var terminationComment = "{ Game ends by variant rule. }";

    if (pgn.termResult == "T") {
      terminationComment = `{ ${pgn.termColor} wins on time. }`;
    }
    else if (pgn.termResult == "R") {
      terminationComment = `{ ${pgn.termColor} resigns. }`;
    }
    else if (["D", "S"].includes(pgn.termResult)) {
      terminationComment = `{ The game is a draw. }`;
    }

    var termination = "Normal";

    if (pgn.termResult == "T")
      termination = "Time forfeit";

    var pgnText = pgn.pgn;

    var template = `[Event "Rated Atomic game (${gameUrl})"]
[White "${white}"]
[Black "${black}"]
[WhiteElo "${whiteElo}"]
[BlackElo "${blackElo}"]
[WhiteRatingDiff "${whiteRatingDiff}"]
[BlackRatingDiff "${blackRatingDiff}"]
[Result "${result}"]
[Variant "Atomic"]
[TimeControl ${timeControl}]
[ECO "?"]
[Opening "?"]
[Termination "${termination}"]

${pgnText} ${terminationComment} ${result}
`;

    return template;
  }

  function downloadPGN() {
    var ffButton = document.getElementsByClassName("chevron-next")[0];
    //var ffButton = $(".chevron-next")

    ffButton.click();
    var _downloadPGN = function () {
      var playerStats = document.getElementsByClassName("gameover-standings-standing");

      if (!playerStats) {
        setTimeout(_downloadPGN, 100);
        console.log("waiting for playerStats");
        return;
      }

      var a = document.createElement("a");
      document.body.appendChild(a);
      a.style = "display: none";
      var blob = new Blob([getPGNStr()], {
          type: "octet/stream"
        }),
        url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = "game.pgn";
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }

    setTimeout(_downloadPGN, 100);
  }

  var isButtonAdded = false;
  var button;

  function start() {
    if (window.location.href.indexOf('chess.com/variants/atomic/game/') === -1)
      return;
    console.log("start");

    var playerStats = document.getElementsByClassName("gameover-standings-standing");
    var panel = document.getElementsByClassName("moves-controls-row");
    if (panel.length < 2)
      return;

    if (!playerStats || !panel) {
      //console.log(`playerStats ${playerStats} panel ${panel}`)
      if (isButtonAdded) {
        //console.log(`playerStats ${playerStats} panel ${panel}`)
        //button.setAttribute("")
        //button.setAttribute("disabled", true);
      }
      return;
    }
    else if (playerStats && isButtonAdded) {
      //console.log(`playerStats ${playerStats} panel ${panel}`)
      //button.setAttribute("")
      //button.setAttribute("disabled", false);
    }

    if (!isButtonAdded) {
      button = document.createElement('div');
      button.innerHTML = `<div class="moves-btn-icon moves-reset">
    <span class="moves-icon icon-font-chess download icon-font-neutral" onclick="downloadPGN(); return false">
    </span></div>`;
      panel[0].appendChild(button);

      //console.log("inject script");
      var script = document.createElement('script');
      script.appendChild(document.createTextNode(getPlayersStats.toString()));
      script.appendChild(document.createTextNode(getTimeControl.toString()));
      script.appendChild(document.createTextNode(getPGN.toString()));
      script.appendChild(document.createTextNode(getPGNStr.toString()));
      script.appendChild(document.createTextNode(downloadPGN.toString()));
      //console.log(script);
      (document.body || document.head || document.documentElement).appendChild(script);

      isButtonAdded = true;
    }

    //getPGNStr();
  }

  var target = document.body;
  var config = {
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true,
    childList: true,
    subtree: true
  };

  var observer = new MutationObserver(start);
  observer.observe(target, config);

})();
