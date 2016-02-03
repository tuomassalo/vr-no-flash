(function(window) {
  'use strict';

  /*
   * This file is included by the bookmarklet (see index.html).
   * NB: uses jquery-1.4.2.min.js, included by the site.
   */


  /*
   * Coach `n` is initially loaded, along with {prev,next}CoachAvailable info.
   * We don't know:
   * - how many coach numbers are available
   * - which coach numbers are available
   * - which coach number is the lowest or highest
   * - whether the coach numbers are consecutive

   * We cannot "load coach n", we can only "load next/prev coach of n", which might
   * not be n+1 or n-1.

   * The algorithm:
   * - Start traversing the coach numbers to both directions.
   * - Show loader gifs until the first and last coach are drawn.
   */


  /* [1] The stuff that happens when the bookmarklet is loaded:
   *     - add styles
   *     - declare coachDefinitions var (caching wanted)
   *     - override loadFlash function
   */

  $(
    '<style type="text/css">' +

    // Only make the seats clickable (see .css() call below)
    '#nf-coaches svg { pointer-events: none; }' +

    // Hide Flash stuff.
    '#flashPageDiv, object, .loadflash, .infoBoxCoachMap { display: none }' +

    // Give some love to the button.
    '#ResEnq_0_true:after { content: " \u2764"}' +

    // Some styling for the new elements
    '.boxy-inner.nf-boxy { background: #ddd}' +
    '#nf-loader-prev, #nf-loader-next { margin: 20px auto; display: block; }' +
    '#nf-coaches svg { padding: 0 1.5em 20px; width: 800px; }' +
    '#nf-coaches>div { background: #fff; border-radius: 5px; margin: 10px; width:830px }' +
    '#nf-coaches h2 { font: bold 24px Arial; padding: 20px 10px 0 30px; margin: 0; }' +
    '#nf-coaches h2 span { font: normal 16px Arial; font-style: italic; color: #555; padding-left: 1em; }' +
    '#nf-buttons { padding: 0 10px 35px 6px; }' +
    '#nf-buttons span.btnGreen { float:right; }' +
    '</style>'
  ).appendTo("head");

  var scriptBase = $('script[src*="/nf.js"], script[src*="/nf.min.js"]').attr('src').replace(/nf\.(min\.)?js.*/, '');

  // NB: This list is populated by build.sh
  var knownCoachTypes = {/*KNOWN_COACH_TYPES*/};

  // SVG files are stored to this object. Key: coach type, eg. "EDM", value: SVG string.
  var coachDefinitions = {};

  // Debug aids.
  window.console = window.console || {};
  console.log = console.log || function() {};

  // Override the function in https://shop.vr.fi/onlineshop/pages/static/js/common/scripts.js.
  window.loadFlash = function() {

    // Coach metadata. Key: coach number, value: object.
    var coaches = {};

    // To keep track of Reservation_{prev,next}.do requests.
    // Keys are eg. "prev3" (this key is about the 'previous coach of coach #3'),
    // Possible values are: 1==loading, 2==loaded
    var coachesRequested = {};

    // Container div.
    var $coaches;

    var noOfPassengers = parseInt($('#noOfPassengers').val());

    // List of selected seats, oldest first. Each item is eg.: {"coach":"39","seat":"34"}
    var selections = [];

    // A job queue of coaches to show. Each element is an array: [coachType, callback].
    var showCoachQueue = [];

    // A counter to keep the SVG ids unique. This must be different for each SVG tag,
    // so we increment this every time we render a coach.
    var coachCounter = 0;


    // This function checks if we can hide the throbbers already.
    function updateLoaders() {
      var showLoaders = {prev: false, next: false};
      $.each(coachesRequested, function(k,v) {
        if(v === 1) { // "loading"
          showLoaders[k.substr(0,4)] = true;
        }
      });
      $('#nf-loader-prev').toggle(showLoaders.prev);
      $('#nf-loader-next').toggle(showLoaders.next);
    }

    // Given a context and optionally the direction where we traversed from,
    // check if adjacent coaches are available and load them.
    function loadAdjacentCoaches(context, originDir) {
      var coachNumber = /* coachNumberOverride || */ parseInt($("#coachNo", context).val());
      if(isNaN(coachNumber)) {
        return;
      }

      ['prev', 'next'].forEach(function(dir) {

        // We came from this direction. Don't go back. (Only matters with non-consecutive numbering.)
        if(originDir && originDir != dir) {
          return;
        }

        if(
          (/*coachNumberOverride || */ $('#' + dir + 'CoachAvailable', context).val() === 'true') &&
          !(
            // Don't request if:
            // ... this request has already been made
            coachesRequested[dir + coachNumber] ||
            // or if the next coach already exists
            coaches[coachNumber + (dir === 'prev' ? -1 : 1)] ||
            // or if a similar request has been made from "the other side", eg. "next2" == "prev4"
            coachesRequested[dir + coachNumber + (dir === 'prev' ? -2 : 2)]
          )
        ) {

          coachesRequested[dir + coachNumber] = 1; // loading

          var $form = $('#seatMapForm').clone();
          $form.find('#coachNo').val(coachNumber);
          $form.ajaxSubmit({
            url: 'Reservation_' + dir + '.do',
            success: function(d) {
              coachesRequested[dir + coachNumber] = 2; // loaded
              var doc = (new DOMParser()).parseFromString(d, 'text/html');
              var newCoachNumber = $("#coachNo", doc).val();
              if(newCoachNumber) {
                showCoach(doc, dir);
              }
              // else: there was no such coach, don't try to render. Update loaders anyway.

              updateLoaders();
            }
          });
        }
      });
      updateLoaders();
    }


    function showCoach(context, originDir) {

      var coachType = $("#coachType", context).val();
      if(!coachType) {
        console.log("no type?", context, $("#coachType", context));
        return;
      }
      var coachNumber = $("#coachNo", context).val();

      // Optimize: if the first coach shown is > 4, also try to start loading earlier coaches
      /*
      if(this_is_first_coach && coachNumber > 4) {
        loadAdjacentCoaches(context, coachNumber - 3);
      }
      */

      var $coach = $('<div/>');
      $coach.attr('data-nf-coach-number', coachNumber);
      $coaches.children().each(function() {
        if(parseInt($(this).attr('data-nf-coach-number')) > parseInt(coachNumber)) {
          $coach.insertBefore(this);
          return false;
        }
      });

      if(coaches[coachNumber] && coaches[coachNumber].type) {
        return;
      }

      coaches[coachNumber] = {
        $dstElem: $coach,
        number: coachNumber,
        type: coachType,
        title: $('input#coachDescription', context).val(),
        statusXML: $('input#coachXMLString', context).val(),
      };

      loadAdjacentCoaches(context, originDir);
      drawCoach(coaches[coachNumber]);
    }


    // Add filters for coloring the seats.
    var filters = 
      '<filter id="status-na">' +
      '</filter>' +
      '<filter id="status-free">' +
        '<feComponentTransfer>' +
          '<feFuncR type="linear" slope=".32"/>' +
          '<feFuncG type="linear" slope="1"/>' +
          '<feFuncB type="linear" slope=".32"/>' +
        '</feComponentTransfer>' +
      '</filter>' +
      '<filter id="status-taken">' +
        '<feComponentTransfer>' +
          '<feFuncR type="linear" slope="1"/>' +
          '<feFuncG type="linear" slope="0"/>' +
          '<feFuncB type="linear" slope="0"/>' +
        '</feComponentTransfer>' +
      '</filter>' +
      /*
      '<filter id="status-season">' +
        '<feComponentTransfer>' +
          '<feFuncR type="linear" slope="1"/>' +
          '<feFuncG type="linear" slope=".5"/>' +
          '<feFuncB type="linear" slope=".5"/>' +
        '</feComponentTransfer>' +
      '</filter>' +
      */
      '<filter id="status-selected">' +
        '<feComponentTransfer>' +
          '<feFuncR type="linear" slope="1"/>' +
          '<feFuncG type="linear" slope="1"/>' +
          '<feFuncB type="linear" slope="0"/>' +
        '</feComponentTransfer>' +
      '</filter>'
    ;

    // A callback called by <TYPE>.js files
    window.nfDefineCoach = function(c) {
      coachDefinitions[c.type] = c.svg;
      processShowCoachQueue();
    };

    function processShowCoachQueue() {
      showCoachQueue = showCoachQueue.filter(function(queueItem) {
        if(coachDefinitions[queueItem[0]]) {
          queueItem[1]();
          return false; // remove from queue
        } else {
          return true; // keep in queue
        }
      });
    }

    function drawCoach(coach) {
      var $heading = $('<h2/>').text("VAUNU " + coach.number);
      $heading.append($('<span/>').text(coach.title + ' (' + coach.type + ')'));
      coach.$dstElem.append($heading);

      // Quick hack to show IM1A as IM1 (Currently no idea why it works in Flash)
      var coachTypeAliasMap = {
        IM1A: 'IM1',
      };
      if(coachTypeAliasMap[coach.type]) {
        coach.type = coachTypeAliasMap[coach.type];
      }

      showCoachQueue.push([coach.type, function() {
        _drawCoach(coach);
      }]);

      if(Object.keys(knownCoachTypes).length && !knownCoachTypes[coach.type]) {
        alert("Vaunutyyppiä '" + coach.type + "' ei löydy. :(");
      }

      if(coachDefinitions[coach.type]) {
        // don't "release zalgo"
        window.setTimeout(processShowCoachQueue, 1);
      } else {
        $.ajaxSetup({cache: true});
        $.getScript(scriptBase + 'coaches/' + coach.type + '.js');
        $.ajaxSetup({cache: false});
      }
    }

    function _drawCoach(coach) {
      coachCounter++;
      coach.svgId = coachCounter;

      // Do some last-minute modification to the SVG strings:
      // - remove width and height
      // - convert ids and xlink:href attributes to make them unique:
      //   prepend "c1" for the first SVG file, "c2" for the second, etc.
      var coachDef = coachDefinitions[coach.type]
        .replace(/ width="\w+"/, '')
        .replace(/ height="\w+"/, '')
        .replace(/ id="(?=\w+")/g, ' id="c' + coach.svgId)
        .replace(/ xlink:href="#(?=\w+")/g, ' xlink:href="#c' + coach.svgId)
      ;

      // If this is the first SVG file, add the seat color filters.
      if(coach.svgId === 1) {
        coachDef = coachDef.replace(/<defs>/, '<defs>' + filters);
      }

      var coachSVG  = (new DOMParser()).parseFromString(coachDef,          'text/xml');
      var statusXML = (new DOMParser()).parseFromString(coach.statusXML, 'text/xml');

      // parse coach XML data, add to seatStatuses
      coach.statuses = {};
      $('seat', statusXML).each(function() {
        var $s = $(this);
        var seatNumber = $s.find('number').text();
        if($s.find('selected').text() === '1') {
          coach.statuses[seatNumber] = 'selected';
          selections.push({coach:coach.number, seat:seatNumber});
        } else {
          var status = $s.find('status').text();
          if(status === '0') {
            coach.statuses[seatNumber] = 'free';
          /*
          } else if(status === '6') {
            coach.statuses[seatNumber] = 'season';
          */
          } else {
            // Other statuses - assume taken. Probably:
            // 5 - wheelchair assistant; pet companion
            // 6 - seasonal ticket reservation
            if(!/^[16]$/.test(status)) {
              console.log("UNKNOWN SEAT STATUS", coach.number, seatNumber, status);
            }
            coach.statuses[seatNumber] = 'taken';
          }
        }
      });

      // Remove coloring from all seats
      function removeSeatColor(elem) {
        var href;
        while(href = elem.getAttribute('xlink:href')) { // NB: intentional single equals sign
          elem = $(href)[0];
        }
        $(elem).find('*').andSelf().attr('fill', '#fff');
      }

      coachSVG.children[0].id = 'nf-svg-' + coach.svgId;
      coach.$dstElem.append(coachSVG.children[0]);
      coach.$dstElem.find('svg').hide().fadeIn();

      // Helper function
      function qsa(sel) {
        return Array.prototype.slice.apply(
          document.querySelectorAll('svg#nf-svg-' + coach.svgId + ' ' + sel)
        );
      }

      // Move floorplan from defs to make pointer events easier.
      var floorplan_use = qsa('[class="n-floorplan"]')[0];
      var floorplan_def = qsa(floorplan_use.getAttribute('xlink:href'))[0];
      floorplan_def.setAttribute('transform', floorplan_use.getAttribute('transform'));
      floorplan_use.parentNode.removeChild(floorplan_use);
      floorplan_def.parentNode.removeChild(floorplan_def);
      qsa('')[0].appendChild(floorplan_def);

      coach.drawSeatStatuses = function(seat) {
        var sel = seat ? '[class="n-seat_' + seat + '"]' : '[class^="n-seat_"]';
        qsa(sel).forEach(function(seatElem) {
          removeSeatColor(seatElem);
          $(seatElem.getAttribute('xlink:href')).css({
            cursor:'pointer',
            pointerEvents:'all',
          });
          var seatNumber = seatElem.className.baseVal.replace(/^n-seat_/, '');
          if(seatNumber in coach.statuses) {
            seatElem.setAttribute('filter', 'url(#status-' + coach.statuses[seatNumber] + ')');
          }
        });
      };

      coach.drawSeatStatuses();

      // Add click handler
      qsa('[class^="n-seat_"]').forEach(function(seatElem) {
        $(seatElem).click(function() {
          var seatNumber = this.className.baseVal.replace(/^n-seat_/, '');
          if(coach.statuses[seatNumber] === 'free') {
            selections.push({coach: coach.number, seat: seatNumber});
            coach.statuses[seatNumber] = 'selected';
            if(selections.length > noOfPassengers) {
              var removed = selections.shift();
              coaches[removed.coach].statuses[removed.seat] = 'free';
              coaches[removed.coach].drawSeatStatuses(removed.seat);
            }
            coach.drawSeatStatuses(seatNumber);
          }
        });
      });
    }

    // Initialize the no-flash view.
    $coaches = $('<div id="nf-coaches"/>');

    // Make ordering easier with this helper div.
    $coaches.append($('<div/>').attr('data-nf-coach-number', 999));

    // Add throbbers and save/cancel buttons.
    $('#flashPageDiv').after(
      '<img id="nf-loader-prev" src="https://shop.vr.fi/onlineshop/pages/ram/img/loadingAnimation.gif">',
      $coaches,
      '<img id="nf-loader-next" src="https://shop.vr.fi/onlineshop/pages/ram/img/loadingAnimation.gif">',
      '<div id="nf-buttons">' +
        '<span class="btnVR middle btnGreen"><a href="#">Vahvista</a></span>' +
        '<span class="btnVR middle btnGrey"><a href="#">Peruuta</a></span>' +
      '</div>'
    );

    // Add styling to the Boxy overlay
    $('#flashPageDiv').closest('.boxy-inner').addClass('nf-boxy');

    $('#nf-buttons a:first').click(function() {
      var unselectedCount = noOfPassengers - selections.length;
      if(unselectedCount) {
        alert("Valitse vielä " + unselectedCount + " paikka" + (unselectedCount > 1 ? 'a' : ''));
        return;
      }
      var coach = selections[0].coach;
      var seats = "";
      selections.forEach(function(s) {
        if(coach !== s.coach) {
          alert("Valitettavasti tällä virityksellä voi varata paikkoja vain yhdestä vaunusta kerrallaan.");
          return;
        }
        seats += ',seat_' + s.seat;
      });
      seats = seats.replace(/^,/, '');

      $('#seatMapForm #coachNo').val(coach);

      // saveSeatReservations if defined in https://shop.vr.fi/onlineshop/pages/static/js/common/scripts.js.
      // It does some stuff, then calls $('#seatMapForm').ajaxSubmit()
      saveSeatReservations('./Reservation_add.do', seats);

    });
    $('#nf-buttons a:last').click(function() {
      $('a.close').trigger('click');
    });

    // Start showing the coaches.
    showCoach(document);

  };

})(this);
