// Author: John Jourish DC. Abasolo
// Description: Implementation of the structural variant visualization using D3.js and jQuery

// GLOBAL CONSTANTS
// - file-related
// const fileDirRefGenome = 'data/IRGSP-1.0_genome.fa';
const fileDirRefGenome = 'data/dummyref.txt';
const fileDirSVDel = 'data/dummysv-del.txt';
// const fileDirSVDel = 'data/dummysv-ins.txt';
// - svg-related
const svg = d3.select('#sv-visualization-ins');
const svgTopMargin = 50; // in px
const svgLeftMargin = 20; // in px
const trackHeight = 5; // in px
const minimumRange = 10; // in bp
const maximumRange = 50000; // in bp

const minInterval = 10; // in bp
const maxInterval = 100; // in bp
const minFlank = 20; // in bp
const maxFlank = 50; // in bp

// GLOBAL VARIABLES
let referenceGenome = [];
let structuralVariants = {};
let svToDraw = [];
let svFrequency = {};
let hotspotFrequency = {};
let noOfChr = 0;
let noOfClusters = 0;
let flankingValue = 20; // in bp
let startChr = 0; // in bp
let endChr = 0; // in bp
// - svg-related
let maxChrBound = 0;
let rulerInterval = 20; // in px
let showSequence = true;
let nightMode = false;
let panZoomSVG = null;
let zoom = true;
let pan = true;
// - ui-related
let showOptions = true;
let isSidebarOpen = true;

// initialization
function initialize(){
	readTextFile();
	initializeActionListeners();
	changeHTMLDOM();
	setupSemantic();
}

// local file reading [jQuery] taken from https://stackoverflow.com/a/10112551
function readTextFile(){
	$.get(fileDirRefGenome, function(data) {
		let referenceGenomeArray = [];
		data = data.replace(/[\n\s]/g, '');
		referenceGenomeArray = data.split(/>chr\d*/g);
		referenceGenomeArray.shift();
		noOfChr = referenceGenomeArray.length;

		constructReferenceGenome(referenceGenomeArray);
		initializeSetCoordinates();
	}, 'text');

	$.get(fileDirSVDel, function(data) {
		let svArray = [];
		svArray = data.split(/\n/g);

		constructStructuralVariants(svArray);
	}, 'text');
}

// creates the referenceGenome array @ readTextFile()
function constructReferenceGenome(array){
	let chrList = '';

	for(var i = 0; i < noOfChr; i++){
		let chrObj = {};	
		chrObj['num'] = i + 1;
		chrObj['seq'] = array[i];
		chrObj['len'] = array[i].length;
		referenceGenome[i] = chrObj;
		chrList = chrList + '<option value=' + (i+1) + '>chr ' + (i+1) + '</option>';

		if(i == 0) $('#max-count').text(array[i].length); // loads the length to the max-count div at start
	}

	$('#chr-num-select').append(chrList);
}

// creates the structural variant object @ readTextFile()
function constructStructuralVariants(array){
	svFrequency = {'INS':{}, 'DEL':{}, 'INV':{}, 'DUP':{}};
	structuralVariants = {'INS':[], 'DEL':[], 'INV':[], 'DUP':[]};

	// check if the sv file is [dup, del, inv] or [ins]
	let sv = array[0].split(/\t/g),
			svFourthCol = sv[3].match(/;/g),
			isDelDupInv = (svFourthCol != null) ? true : false;

	// proceed to data structure composition
	for(var i = 0; i < array.length; i++){
		let sv = array[i].split(/\t/g),
				typeLen = (isDelDupInv) ? sv[3].split(/;/g) : ["INS", "1"]; // [0] == type, [1] == length
				svObj = {};

		svObj['chrNum'] = Number(sv[0].replace(/chr/g, ''));
		svObj['start'] = Number(sv[1]);
		svObj['end'] = Number(sv[2]);
		svObj['length'] = Number(typeLen[1]);
		svObj['sampleID'] = sv[4];
		svObj['cluster'] = Number(sv[5]);

		if(!isDelDupInv){
			svObj['insertedSeq'] = sv[3].split(/,/g);
		}

		svFrequency[typeLen[0]][Number(sv[5])] = 1 + (svFrequency[typeLen[0]][Number(sv[5])] || 0);
		structuralVariants[typeLen[0]][structuralVariants[typeLen[0]].length] = svObj;
	}
}

// draw the visualization on the SVG [D3] @ readTextFile()
function renderVisualization(){
	svg.selectAll('*').remove(); // clear svg
	setDetailsOnSubMenu();
	addPopup();
	drawRuler();
	drawReferenceGenome();
	drawStructuralVariants();
	// enablePanAndZoom();
}

// sets detail on sub menu (appears when sidebar is closed) @ renderVisualization()
function setDetailsOnSubMenu(){
	let startChr = Number($('#chr-start').val()),
			endChr = Number($('#chr-end').val()),
			chrNum = Number($('#chr-num-select').val());

	$('#submenu-chr').text(chrNum);
	$('#submenu-start').text(startChr + ' bp');
	$('#submenu-end').text(endChr + ' bp');
}

// add popup on track click [D3 + jQuery] @ renderVisualization()
function addPopup(){
	popup =
	  '<div class="ui pointing basic label">' +
			'<div class="ui list">' +
			  '<div class="item">' +
			    '<div class="ui image large label" id="sv-label">' +
			      'Structural variant type' +
			      '<div class="detail" id="sv-label-detail"></div>' +
			    '</div>' +
			  '</div>' +
			  '<div class="item">' +
			    '<div class="ui image grey large label">' +
			      'Chr no.' +
			      '<div class="detail" id="sv-label-chr-detail"></div>' +
			    '</div>' +
			    '<div class="content">' +
				    '<div class="ui image grey large label">' +
				      'Cluster' +
				      '<div class="detail" id="sv-label-cluster-detail"></div>' +
				    '</div>' +
			    '</div>' +
			  '</div>' +
			  '<div class="item">' +
			    '<div class="ui image grey large label">' +
			      'Start' +
			      '<div class="detail" id="sv-label-start-detail"></div>' +
			    '</div>' +
			    '<div class="content">' +
			      '<div class="ui image grey large label">' +
			        'End' +
			        '<div class="detail" id="sv-label-end-detail"></div>' +
			      '</div>' +
			    '</div>' +
			  '</div>' +
			  '<div class="item">' +
		      '<div class="ui image grey large label">' +
		        'Sample ID' +
		        '<div class="detail" id="sv-label-sampleID-detail"></div>' +
		      '</div>' +
			  '</div>' +
		  '</div>' +
	  '</div>';

	svg
		.append('foreignObject')
			.attr('id', 'popup-element')
			.attr('x', -1000)
			.attr('y', -1000)
			.attr('height', 10)
			.attr('width', 500);
	$('#popup-element').html(popup);
}

// draw the ruler at the top [D3] @ renderVisualization()
function drawRuler(){
	var chrNum = Number($('#chr-num-select option:selected').val()) - 1,
			currentChr = referenceGenome[chrNum],
			chrSequence = currentChr.seq.toUpperCase(),
			interval = 0,
			rightAllowance = 10;
			
	flankingValue = Number($('#ruler-flank').val())
	maxChrBound = currentChr.len * 7;

	chrSequence = setSequenceRange(chrSequence, true);

	$('#sv-visualization').attr('width', maxChrBound + (svgLeftMargin * 2) + (bpToPx(flankingValue) * 2)); // adjusts the svg for it to be scrollable

	// draws the horizontal ruler
	svg
		.append('g')
			.attr('class', 'ruler')
		.append('line')
			.attr('x1', 0)
			.attr('x2', maxChrBound + (svgLeftMargin * 2) + (bpToPx(flankingValue) * 2) + rightAllowance)
			.attr('y1', svgTopMargin)
			.attr('y2', svgTopMargin)
			.attr('stroke-width', 2)
			.attr('stroke', 'black');

	addRulerInterval();
	addSequenceText(chrSequence);
}

	// sets the sequence range to be displayed @ drawRuler()
	function setSequenceRange(sequence, replace){
		if(replace){
			$('#max-count').text(maxChrBound/7);
		}

		startChr = Number($('#chr-start').val() - 1);
		endChr = Number($('#chr-end').val());
		maxChrBound = (endChr - startChr) * 7;

		return sequence.substring(startChr, endChr);
	}

	// adds the ruler interval, can be edited by the user [D3] @ drawRuler()
	function addRulerInterval(){
		// update current ruler interval
		rulerInterval = Number($('#ruler-interval').val()); 

		let chrStart = Number($('#chr-start').val()),
				chrEnd = Number($('#chr-end').val()),
				textInterval = chrStart - flankingValue - 1,
				interval = chrStart - bpToPx(flankingValue),
				intervalCount = Math.ceil((maxChrBound / 7) / rulerInterval) + 2,
				flank = bpToPx(flankingValue),
				startPx = flank + svgLeftMargin + 2;
				endPx = bpToPx(chrEnd - chrStart) + startPx;

		if((maxChrBound / 7) % rulerInterval == 0){
			intervalCount = intervalCount + 1;
		}

		// always add and interval on the start and end of query
		// adds the vertical line indicator
		svg
			.append('g')
				.attr('class', 'ruler')
			.append('line')
				.attr('x1', 0 + startPx)
				.attr('x2', 0 + startPx)
				.attr('y1', svgTopMargin - 10)
				.attr('y2', svgTopMargin)
				.attr('stroke-width', 1)
				.attr('stroke', 'red')
		;

		// adds the interval text
	  svg
			.append('g')
				.attr('class', 'ruler')
	  	.append('text')
		    .attr('x', 2 + startPx)
		    .attr('y', svgTopMargin - 3)
		    .attr('font-family', 'Courier, "Lucida Console", monospace')
		    .attr('font-size', '12px')
		    .attr('fill', 'red')
	    .text(chrStart)
	    .style('pointer-events', 'none')

		// adds the vertical line indicator
		svg
			.append('g')
				.attr('class', 'ruler')
			.append('line')
				.attr('x1', 0 + endPx)
				.attr('x2', 0 + endPx)
				.attr('y1', svgTopMargin - 10)
				.attr('y2', svgTopMargin)
				.attr('stroke-width', 1)
				.attr('stroke', 'blue')
		;

		// adds the interval text
	  svg
			.append('g')
				.attr('class', 'ruler')
	  	.append('text')
		    .attr('x', 2 + endPx)
		    .attr('y', svgTopMargin - 3)
		    .attr('font-family', 'Courier, "Lucida Console", monospace')
		    .attr('font-size', '12px')
		    .attr('fill', 'blue')
	    .text(chrEnd)
	    .style('pointer-events', 'none')

	  var adjustingValue = textInterval + flankingValue + 1;
	  if(adjustingValue != 1){
		  adjustingValue = Math.abs(adjustingValue - 10);
		  textInterval = textInterval + adjustingValue + 1;
	  }

		for(var i = 0; i < intervalCount; i++) {
			// adds the vertical line indicator
			svg
				.append('g')
					.attr('class', 'ruler')
				.append('line')
					.attr('x1', 0 + interval + svgLeftMargin + flank)
					.attr('x2', 0 + interval + svgLeftMargin + flank)
					.attr('y1', svgTopMargin - 10)
					.attr('y2', svgTopMargin)
					.attr('stroke-width', 1)
					.attr('stroke', 'black')
			;

			// adds the interval text
		  svg
				.append('g')
					.attr('class', 'ruler')
		  	.append('text')
			    .attr('x', 2 + interval + svgLeftMargin + flank)
			    .attr('y', svgTopMargin - 3)
			    .attr('font-family', 'Courier, "Lucida Console", monospace')
			    .attr('font-size', '12px')
			    .attr('fill', 'black')
		    .text(textInterval)
		    .style('pointer-events', 'none')
		  ;		

			interval = interval + (rulerInterval * 7);
			textInterval = textInterval + rulerInterval;
		}
	}

	// adds the sequence text, can be toggled [D3] @ drawRuler()
	function addSequenceText(chrSequence){
		// draws the sequence text
		if(showSequence){
			let flank = bpToPx(flankingValue);
		 	 svg
		  	.append('g')
		  		.attr('class', 'sequence-text')
		  	.append('text')
					.attr('x', 0 + svgLeftMargin + flank)
					.attr('y', svgTopMargin + 25)
					.attr('font-family', 'Courier, "Lucida Console", monospace')
					.attr('font-size', '12px')
					.attr('fill', 'black')
				.text(chrSequence)
				.style('pointer-events', 'none');  
		}
	}

// draws the reference genome line [D3] @drawRuler()
function drawReferenceGenome(){
	let flank = bpToPx(flankingValue),
			rightAllowance = bpToPx(10);

	// pattern on mmouse hover, code taken from: http://jsfiddle.net/yduKG/3/
	svg
	  .append('defs')
	  .append('pattern')
	    .attr('id', 'diagonalHatch')
	    .attr('patternUnits', 'userSpaceOnUse')
	    .attr('width', 4)
	    .attr('height', 4)
	  .append('path')
	    .attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
	    .attr('stroke', '#ffffff')
	    .attr('stroke-width', 2)
  ;

	// provides the bg color at the bottom of the pattern
  svg
		.append('g')
			.attr('class', 'reference-genome-line')
		.append('rect')
			.attr('x', 0)
			.attr('y', svgTopMargin + 30)
			.attr('width', maxChrBound + svgLeftMargin + (flank * 2) + rightAllowance)
			.attr('height', trackHeight)
			.attr('trackID', 'reference-genome')
			.attr('color', '#424242')
		.style('fill', '#424242')
	;

	// the reference genome line
	svg
		.append('g')
			.attr('class', 'reference-genome-line')
		.append('rect')
			.attr('x', 0)
			.attr('y', svgTopMargin + 30)
			.attr('width', maxChrBound + svgLeftMargin + (flank * 2) + rightAllowance)
			.attr('height', trackHeight)	
			.attr('trackID', 'reference-genome')
			.attr('color', '#424242')
		.style('fill', '#424242')
		.on('mouseover', trackMouseOver)
    .on('mouseout', trackMouseOut)
  ;
}

	// highlight effect on hover [D3] @ drawReferenceGenome()
	function trackMouseOver(){
		if(this.attributes.color.value == '#82131b'){
			var wew = [];
			wew = $('.sv-inv-arrowhead')
			for (var i = 0; i < wew.length; i++) {
				if(wew[i].attributes.start.value == this.attributes.start.value){
					$('.sv-inv-arrowhead')[i].attributes.fill = 'url(#diagonalHatch)';
				}
			}
			// console.log(wew);
		}

	  d3.select(this).style('fill', 'url(#diagonalHatch)');
	}

	// returns the previous color of the highlighted track [D3] @ drawReferenceGenome()
	function trackMouseOut(){
	  const color = d3.select(this).attr('color');
	  d3.select(this).style('fill', color);

		$('#popup-element').attr('x', '-1000');
		$('#popup-element').attr('y', '-1000');
		$('#sv-label').removeClass('teal', 'blue', 'violet', 'purple');
	}

	// shows the popup on del/inv/dup track click @ drawReferenceGenome()
	function trackClick(){
		let startChr = Number($('#chr-start').val()),
				endChr = Number($('#chr-end').val()),
				chrNum = Number($('#chr-num-select').val()),
				svType = $('input[name=sv-type]:checked').val(),
				color = svToText(0), x, y;

		// make popup appear
		x = isSidebarOpen ? event.clientX - 380 : event.clientX - 120;
		y = event.clientY - 55;
		$('#popup-element').attr('x', x);
		$('#popup-element').attr('y', y);

		$('#sv-label').addClass(color);
		$('#sv-label-detail').text(svType);
		$('#sv-label-chr-detail').text(chrNum);
		$('#sv-label-start-detail').text($(this).attr('start') + ' bp');
		$('#sv-label-end-detail').text($(this).attr('end') + ' bp');
		$('#sv-label-cluster-detail').text($(this).attr('cluster'));
		$('#sv-label-sampleID-detail').text($(this).attr('sampleID'));
	}

	// shows the modal on ins marker click @ drawReference()
	function markerClick(){
		$('.sequence-delete').remove();

		$('.modal').modal('show');

		let startChr = Number($('#chr-start').val()),
				endChr = Number($('#chr-end').val()),
				chrNum = Number($('#chr-num-select').val()),
				svType = $('input[name=sv-type]:checked').val(),
				color = svToText(0),
				insertedSeq = $(this).attr('insertedSeq').split(/,/g);

		$('#sv-modal').addClass(color);
		$('#sv-modal-detail').text(svType);
		$('#sv-modal-chr-detail').text(chrNum);
		$('#sv-modal-start-detail').text($(this).attr('start') + ' bp');
		$('#sv-modal-end-detail').text($(this).attr('end') + ' bp');
		$('#sv-modal-cluster-detail').text($(this).attr('cluster'));
		$('#sv-modal-sampleID-detail').text($(this).attr('sampleID'));

		for(let i = 0; i < insertedSeq.length; i++){
			if(insertedSeq[i] != ''){
				$('#sv-modal-insertedSeq-detail').append('<p class="sequence-delete">' + insertedSeq[i] + '<p/>');
			}
		}
	}

// determine the number of branches to be visualized; works for del, dup, inv
function assignHotspotNumber(type){
	let svBranchHeight = 0;
	hotspotFrequency = {};

	// iterate through the sv's then
		// hotspot 1. grp of overlapping intervals 2. magsolo, walang kapatong
		// hotspot == key na lang sa svToDraw, integer starting from 1
	// form a hotspot
		// get start of interval - unang given - minbound
		// get maxbound - end
		// if(nextItem.end >= maxBound) maxBound = nextItem.end
			// updating lang nung maxBound
		// if(maxBound == nextItem.start) kasama pa yun sa bilang ng number of branches?
	
	// if(nextItem.start > maxBound) panibago nang hotspot
	// use the same set of rules para makabilang yung isang interval sa hotspot
	let minBound = svToDraw[0]['start'],
			maxBound = svToDraw[0]['end'],
			hotspotCount = 0;

	svToDraw[0]['hotspot'] = hotspotCount;
	svToDraw[0]['hotspotIndex'] = 0;
	hotspotFrequency[hotspotCount] = 1 + (hotspotFrequency[hotspotCount] || 0);
	svBranchHeight = hotspotFrequency[hotspotCount];

	// console.log('start:' + svToDraw[0]['start'] + ' end:' + svToDraw[0]['end'] + ' stackNo:' + svToDraw[0]['hotspot'] + ' index:' + svToDraw[0]['hotspotIndex']);
	for(var i = 1; i < svToDraw.length; i++){
		let nextSV = svToDraw[i];

		if(type != 'INS'){
			if(nextSV['start'] > maxBound){
				hotspotCount++;
			}
		}
		else{
			if(nextSV['start'] != minBound && nextSV['end'] != maxBound){
				minBound = nextSV['start'];
				maxBound = nextSV['end'];
				hotspotCount++;
			}
		}

		if(type != 'INS'){
			if(nextSV['end'] >= maxBound || maxBound == nextSV['start'] || nextSV['start'] >= minBound ){
				maxBound = nextSV['end'];
				svToDraw[i]['hotspot'] = hotspotCount;
			}
		}
		else{
			if(nextSV['end'] == maxBound || nextSV['start'] == minBound ){
				svToDraw[i]['hotspot'] = hotspotCount;
			}				
		}

		svToDraw[i]['hotspotIndex'] = (hotspotFrequency[hotspotCount] == null) ? 0 : hotspotFrequency[hotspotCount];
		hotspotFrequency[hotspotCount] = 1 + (hotspotFrequency[hotspotCount] || 0);
		if(svBranchHeight < hotspotFrequency[hotspotCount]){
			svBranchHeight = hotspotFrequency[hotspotCount];
		}

		// console.log('start:' + svToDraw[i]['start'] + ' end:' + svToDraw[i]['end'] + ' stackNo:' + svToDraw[i]['hotspot'] + ' index:' + svToDraw[i]['hotspotIndex']);
	}

	return svBranchHeight;
}

// draws the sv's within the specified range @ renderVisualization()
function drawStructuralVariants(){
	let svType = $('input[name=sv-type]:checked').val(),
			svClusters = Object.keys(svFrequency[svType]).length,
			refToSVSpace = 50, // in px
			bodyBGColor = $('.pusher').css('backgroundColor'),
			noOfmaxBranches = assignHotspotNumber(svType),
			rowsSVG = (noOfmaxBranches % 2) != 0 ? noOfmaxBranches - 1 : noOfmaxBranches, 
			flank = bpToPx(flankingValue),
			rightAllowance = bpToPx(10);

	rowsSVG = (trackHeight) * rowsSVG;

	// provides the bg color at the bottom of the pattern
	svg
		.append('g')
			.attr('class', 'sv-merged-line')
		.append('rect')
			.attr('x', 0)
			.attr('y', svgTopMargin + refToSVSpace + rowsSVG)
			.attr('width', maxChrBound + svgLeftMargin + (flank * 2) + rightAllowance)
			.attr('height', trackHeight)
			.attr('color', '#ab1a25')
		.style('fill', '#ab1a25')
	;

	// draws the merged and continuous sv line
	svg
		.append('g')
			.attr('class', 'sv-merged-line')
		.append('rect')
			.attr('x', 0)
			.attr('y', svgTopMargin + refToSVSpace + rowsSVG)
			.attr('width', maxChrBound + svgLeftMargin + (flank * 2) + rightAllowance)
			.attr('height', trackHeight)
			.attr('class', 'sample-genome')
			.attr('color', '#ab1a25')
		.style('fill', '#ab1a25');
		
	if(svType != 'INS'){
		// determines the y position of the 
	  function locateYCoordinate(array){
	  	let index = array[0],
	  			maxCount = hotspotFrequency[array[1]],
			  	count = 0,
			  	flank = bpToPx(flankingValue), 
			  	x = bpToPx(array[3]) + 150,
			  	y = 0,
			  	trackIntervalHeight = 5,
			  	trackToMergedLine = 50
			;

	  	if(maxCount == 1){
	  		// for single-itemed hotspot
		  	return svgTopMargin + rowsSVG + array[2];
	  	}
	  	else{
	  		// for multiple-itemed hotspot
	  		maxCount = maxCount - 1;
		  	count = Math.abs(index - maxCount) - (Math.floor(maxCount / 2));
		  	// count = ((maxCount + 1) % 2 == 0) ? count + 1 : count; // to handle even number of hotspots, aligning to merged sv line
		  	// console.log(count);
		  	count = (count < 0) ? Math.abs(count) + Math.floor(maxCount / 2) + 1 : count;
	  	}
	  	y = svgTopMargin + trackToMergedLine + (Math.abs(count) * ((trackHeight) + trackIntervalHeight));

	  	return y;
	  }

	  // forms the vertices of the DEL/DUP/INV track (rectangle on branch) @ svg.polyline.sv-branch
	  function formVertices(d){  	
			let string = '',
					yFactor = 2.5
					base = svgTopMargin + refToSVSpace + rowsSVG + yFactor,
					y = locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start']]) + yFactor,
					xStart = bpToPx(d['start']) + bpToPx(flankingValue) - 50,
					xEnd = xStart + bpToPx(d['length']) + bpToPx(flankingValue) - 50,
					offset = 10 + ((d['hotspotIndex'] - 1) * 9);

			// makes the branching angle of each branches equal no matter the y position
	  	if(d['hotspotIndex'] > (hotspotFrequency[d['hotspot']]/2)){
	  		let indexFix = (d['hotspotIndex']+1) - Math.ceil(hotspotFrequency[d['hotspot']]/2);
				offset = 10 + ((indexFix - 1) * 9);
	  	}

			if(d['hotspotIndex'] != 0){
				string = (xStart - offset) + ',' + base + ' ';
				string = string + xStart + ',' + y + ' ';
				string = string + xEnd + ',' + y + ' ';
				string = string + (xEnd + offset) + ',' + base + ' ';
				return string;
			}
	  }

		svg
			.selectAll('sv-branch')		
			.data(svToDraw)
				.enter()
			.append('polyline')
				.attr('points', function(d){ return formVertices(d) })
				.attr('color', '#ab1a25')
			.style('fill', 'none')
			.style('stroke', '#ab1a25')
			.style('stroke-width', trackHeight)
	  ;

		svg
			.selectAll('sv-branch')		
			.data(svToDraw)
				.enter()
			.append('polyline')
				.attr('points', function(d){ return formVertices(d) })
				.attr('color', '#ab1a25')
			.style('fill', 'none')
			.style('stroke', '#ab1a25')
			.style('stroke-width', trackHeight)
			.on('mouseover', refMouseOver)
	    .on('mouseout', refMouseOut)
	  ;

	  // changes color of track color when svtype = dup | inv
	  switch(svType){
	  	case 'DUP':
	  		bodyBGColor = '#480b0f';
	  		break;
	  	case 'INV':
	  		bodyBGColor = '#480b0f';
				
				// arrowhead upward
				svg
					.selectAll('sv-inv-arrowhead')		
					.data(svToDraw)
						.enter()
					.append('line')
						.attr('x1', function(d){ return 0 + svgLeftMargin + flank + bpToPx(d['start']) } )
						.attr('x2', function(d){ return 0 + svgLeftMargin + flank + bpToPx(d['start']) + 8 } )
						.attr('y1', function(d){ return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start']]) + 2 } )
						.attr('y2', function(d){ return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start']]) - 4 } )
						.attr('color', bodyBGColor)
						.attr('start', function(d) { return d['start'] })
						.attr('end', function(d) { return d['end'] })
						.attr('cluster', function(d) { return d['cluster'] })
						.attr('sampleID', function(d) { return d['sampleID'] })
						.attr('class', 'sv-inv-arrowhead')
					.style('fill', 'none')
					.style('stroke', bodyBGColor)
					.style('stroke-width', 2)
			  ;

			  // arrowhead downward
				svg
					.selectAll('sv-inv-arrowhead')		
					.data(svToDraw)
						.enter()
					.append('line')
						.attr('x1', function(d){ return 0 + svgLeftMargin + flank + bpToPx(d['start']) } )
						.attr('x2', function(d){ return 0 + svgLeftMargin + flank + bpToPx(d['start']) + 8 } )
						.attr('y1', function(d){ return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start']]) + 2 } )
						.attr('y2', function(d){ return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start']]) + 8 } )
						.attr('color', bodyBGColor)
						.attr('start', function(d) { return d['start'] })
						.attr('end', function(d) { return d['end'] })
						.attr('cluster', function(d) { return d['cluster'] })
						.attr('sampleID', function(d) { return d['sampleID'] })
						.attr('class', 'sv-inv-arrowhead')
					.style('fill', 'none')
					.style('stroke', bodyBGColor)
					.style('stroke-width', 2)
			  ;

	  		break;
	  }

		// highlight the range of the given sv 
		svg
			.selectAll('sv-sample')		
			.data(svToDraw)
				.enter()
			.append('rect')
				.attr('x', function(d){ return 0 + svgLeftMargin + flank + bpToPx(d['start']) } )
				.attr('y', function(d){ return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start']])} )
				.attr('width', function(d) { return bpToPx(d['length']) } )
				.attr('height', trackHeight)
				.attr('color', bodyBGColor)
				.attr('start', function(d) { return d['start'] })
				.attr('end', function(d) { return d['end'] })
				.attr('cluster', function(d) { return d['cluster'] })
				.attr('sampleID', function(d) { return d['sampleID'] })
			.style('fill', bodyBGColor)
			.on('mouseover', trackMouseOver)
	    .on('mouseout', trackMouseOut)
	    .on('click', trackClick)
	  ;
	}
	else{
		// forms the vertices of the INS marker (pentagon pointing downwards) @ svg.polgon.sv-stack
	  function formVertices(d){  	
			let string = '',
					base = svgTopMargin + refToSVSpace + rowsSVG - 10,
					y = base - (d['hotspotIndex'] * 10),
					markerHeight = y + 5,
					xStart = bpToPx(d['start']) + bpToPx(flankingValue) + svgLeftMargin,
					xEnd = bpToPx(d['end']) + bpToPx(flankingValue) + svgLeftMargin;

				string = xStart + ',' + markerHeight + ' ';
				string = string + xStart + ',' + y + ' ';
				string = string + xEnd + ',' + y + ' ';
				string = string + xEnd + ',' + markerHeight + ' ';
				string = string + ((xStart + xEnd) / 2) + ',' + (markerHeight+5) + ' ';

				return string;
	  }

		svg
			.selectAll('sv-stack')		
			.data(svToDraw)
				.enter()
			.append('polygon')
				.attr('points', function(d){ return formVertices(d) } )
				.attr('color', 'black')
			.style('fill', 'black')
	  ;

		svg
			.selectAll('sv-stack')		
			.data(svToDraw)
				.enter()
			.append('polygon')
				.attr('points', function(d){ return formVertices(d) } )
				.attr('start', function(d) { return d['start'] })
				.attr('end', function(d) { return d['end'] })
				.attr('cluster', function(d) { return d['cluster'] })
				.attr('sampleID', function(d) { return d['sampleID'] })
				.attr('insertedSeq', function(d) { return d['insertedSeq'] })
				.attr('color', '#ab1a25')
			.style('fill', '#ab1a25')
			.on('mouseover', trackMouseOver)
	    .on('mouseout', trackMouseOut)
	    .on('click', markerClick)
	  ;	
	}
}

function refMouseOver(){
  d3.select(this).style('stroke', 'url(#diagonalHatch)');
  $('.sample-genome').css('fill', 'url(#diagonalHatch)');
}

// returns the previous color of the highlighted track [D3] @ drawReferenceGenome()
function refMouseOut(){
  let color = d3.select(this).attr('color');
  d3.select(this).style('stroke', color);
  color = $('.sample-genome').attr('color');
  $('.sample-genome').css('fill', color);
}

// enables pan and zoom for the whole SVG [jQuery plugin] @ renderVisualization()
function enablePanAndZoom(){
	if(!panZoomSVG == null)	panZoomSVG.destroy();
	console.log(panZoomSVG);

	panZoomSVG = svgPanZoom('#sv-visualization', {
		panEnabled: true,
		zoomEnabled: true,
		dblClickZoomEnabled: true,
		mouseWheelZoomEnabled: true,
		preventMouseEventsDefault: true,
		zoomScaleSensitivity: 0.12,
		minZoom: 0.1,
		maxZoom: 5,
		fit: true,
		contain: false,
		center: true
	});

	console.log(panZoomSVG);

	// assign svgpan functions to buttons (zoom and pan buttons)
	$('#reset-svg').on('click', function(){
		panZoomSVG.reset();
	});

	$('#toggle-zoom-svg').on('click', function(){
		if(!zoom){
			panZoomSVG.enableZoom();
			$('#toggle-zoom-svg').html('Zoom enabled');
		}
		else{
			panZoomSVG.disableZoom();
			$('#toggle-zoom-svg').html('Zoom disabled');
		}
		zoom = !zoom;
	});

	$('#zoom-in-svg').on('click', function(){
		if(zoom) panZoomSVG.zoomIn();
	});

	$('#zoom-out-svg').on('click', function(){
		if(zoom) panZoomSVG.zoomOut();
	});

	$('#toggle-pan-svg').on('click', function(){
		if(!pan){
			panZoomSVG.enablePan();
			$('#toggle-pan-svg').html('Pan enabled');
		}
		else{
			panZoomSVG.disablePan();
			$('#toggle-pan-svg').html('Pan disabled');
		}
		pan = !pan;
	});
}

// converts base pair to px
function bpToPx(bp){
	return bp * 7;
}

// converts base pair to px
function pxToBp(px){
	return px / 7;
}

// event listeners for html elements [jQuery] @ initialize()
function initializeActionListeners(){
	// reloads the visualization on chr change
	$('#chr-num-select').on('change', function(){
		let chrNum = Number($('#chr-num-select').val()) - 1,
				currentChr = referenceGenome[chrNum];

		$('#max-count').text(currentChr.len);
	});

	// sets the max and min even the user specifies out of boundaries
	$('#ruler-interval').on('focusout', function(){
		let interval = Number($('#ruler-interval').val());
		if(interval < minInterval){
			$('#ruler-interval').val(minInterval);
		}
		else if(interval > maxInterval){
			$('#ruler-interval').val(maxInterval);
		}
	});

	$('#ruler-flank').on('focusout', function(){
		let flank = Number($('#ruler-flank').val());
		if(flank < minFlank){
			$('#ruler-flank').val(minFlank);
		}
		else if(flank > maxFlank){
			$('#ruler-flank').val(maxFlank);
		}
	});

	$('#chr-start').on('focusout', function(){
		let chrStart = Number($('#chr-start').val());
		if(chrStart < 1){
			$('#chr-start').val(1);
		}
	});

	$('#chr-end').on('focusout', function(){
		let chrEnd = Number($('#chr-end').val()),
				maxBound = Number($('#max-count').text());
		if(chrEnd > maxBound){
			$('#chr-end').val(maxBound);
		}
	});

	// toggles the sequence text
	$('#toggle-seq-text').on('change', function(){
		if($('#toggle-seq-text').is(':checked') === true){
			showSequence = false;
		}
		else{
			showSequence = true;	
		}
	});

	$('#left-sidebar-toggle').on('click', function(){
		isSidebarOpen = !isSidebarOpen;
		if(isSidebarOpen){
			$('#svg-holder').css('width', '95%');  // TODO: responsive width
		}
		else{
			$('#svg-holder').css('width', '100%'); 
		}
	});

	// toggles app night mode
	$('#toggle-night-mode').on('change', function(){
		nightMode = ($('#toggle-night-mode').is(':checked') ? false : true);

		if(!nightMode){
			$('.night-mode').addClass('inverted');
			$('.ui.toggle.checkbox input:focus:checked~label, .ui.toggle.checkbox input~label')
				.attr('style', 'color: rgba(255,255,255,.9) !important');
			$('.pusher').attr('style', 'background-color: #757575 !important');
		}
		else{
			$('.night-mode').removeClass('inverted');
			$('.ui.toggle.checkbox input:focus:checked~label, .ui.toggle.checkbox input~label')
				.attr('style', 'color: rgba(0,0,0,.87) !important');
			$('.pusher').attr('style', 'background-color: #EEEEEE !important');
		}
		nightMode = !nightMode;
	});
}

// initializes the set coordinates event listener on the button after reading the data @ readTextFile()
function initializeSetCoordinates(){
	$('#min-range').text(minimumRange);
	$('#max-range').text(maximumRange);
	$('#min-interval').text(minInterval);
	$('#max-interval').text(maxInterval);
	$('#min-flank').text(minFlank);
	$('#max-flank').text(maxFlank);

	$('#chr-coordinates').click(function(){
		$('#svg-holder').css('width', '95%'); // adjusts the svg view at start // TODO: responsive width

		let startChr = Number($('#chr-start').val()) - 1,
				endChr = Number($('#chr-end').val()) - 1,
				maxBound = Number($('#max-count').text()),
				errorRange = false, errorSV = false,
				svType = $('input[name=sv-type]:checked').val();
		
		if(maxBound < endChr){
			// checks if the upper bound exceeds the length of the current chromosome
			$('#range-message').text('The end range exceeds the length of the chromosome.');
			errorRange = true;
		}
		if(startChr > endChr){
			// checks if the lower bound is greater than the lower bound
			$('#range-message').text('Start range is larger than end range.');
			errorRange = true;
		}
		if((endChr - startChr) < minimumRange){
			// checks if the ranges is greater than the set minimum range
			$('#range-message').text('Check the range. The minimum range is ' + minimumRange + '.');
			errorRange = true;
		}
		if(startChr == -1){
			// checks if the start range input fields are empty
			$('#range-message').text('Start range has no value.');
			errorRange = true;
		}
		else if(endChr == -1){
			// checks if the end range input fields are empty
			$('#range-message').text('End range has no value.');
			errorRange = true;
		}
		if(svType == null){
			$('#sv-message').text('Pick a structural variant type to visualize.');
			errorSV = true;
		}

		if(errorRange){
			$('#dismissible-error-range').removeClass('hidden').transition('pulse');
		}
		if(errorSV){
			$('#dismissible-error-sv').removeClass('hidden').transition('pulse');
		}

		if(!errorRange && !errorSV){
			$('#dismissible-error-range').addClass('hidden');
			$('#dismissible-error-sv').addClass('hidden');
			if(checkSVExistence()){
				renderVisualization();
			}
		}
	});	
}

	// draws the structural variants inside the queried start and end @ initializeSetCoordinates()
	function checkSVExistence(){
		let startChr = Number($('#chr-start').val()),
				endChr = Number($('#chr-end').val()),
				chrNum = Number($('#chr-num-select').val()),
				svType = $('input[name=sv-type]:checked').val();
		svToDraw = filterSV();

		if(svToDraw.length == 0){
			svType = svToText(1);

			// sets the message for the error, automatically closes after 10 seconds
			$('#query-header').text('There are no ' + svType + ' found from ' + startChr + 'bp - ' + endChr + 'bp at chromosome number ' + chrNum + '.');
			$('#dismissible-error-query').removeClass('hidden').transition('pulse');
			$('#dismissible-error-query').delay(10000).fadeOut(400);

			return false;
		}	
		return true;
	}

		// collects all the sv's inside the range quried by user @ checkSVExistence()
		function filterSV(){
			let startChr = Number($('#chr-start').val()),
					endChr = Number($('#chr-end').val()),
					svType = $('input[name=sv-type]:checked').val(),
					chrNum = Number($('#chr-num-select option:selected').val()),
					svArray = structuralVariants[svType],
					returnArray = [];
			
			for(var i = 0; i < svArray.length; i++){
				let start = svArray[i]['start'],
						end = svArray[i]['end'],
						num = svArray[i]['chrNum'];

				if(startChr <= start && endChr >= end && chrNum == num){
					returnArray[returnArray.length] = svArray[i];
				}
			}

			return(returnArray);
		}

function svToText(index){
	let svType = $('input[name=sv-type]:checked').val(),
			names = [
				['teal', 'blue', 'violet', 'purple'],
				['deletions', 'inversions', 'duplications', 'insertions'],
			]
	;

	switch(svType){
    case 'DEL':
        svType = names[index][0];
        break;
    case 'INV':
        svType = names[index][1];
        break;
    case 'DUP':
        svType = names[index][2];
        break;
    case 'INS':
        svType = names[index][3];
        break;
    default:
        svType = 'magical SV\'s';
	}

	return svType;
}

// HTML DOM manipulations [jQuery] @ initialize()
function changeHTMLDOM(){	
	// set the initial ruler interval to 20
	$('#ruler-interval').attr('value', '20');
	$('#ruler-interval').attr('min', minInterval);
	$('#ruler-interval').attr('max', maxInterval);
	$('#ruler-interval').attr('step', '10');

	// set the initial ruler flank to 20
	$('#ruler-flank').attr('value', '30');
	$('#ruler-flank').attr('min', minFlank);
	$('#ruler-flank').attr('max', maxFlank);
	$('#ruler-flank').attr('step', '10');

	// set the attributes of the svg
	$('#sv-visualization').attr('height', '500px');
	$('#sv-visualization').attr('width', '100%');

	$('#query-details').css({'-webkit-transform':'translate(-500px, 0px)'});
}

// semantic element initializations and enabling [jQuery] @ initialize()
function setupSemantic(){
	// initialize and enable semantic sidebar
	$('.ui.left.sidebar').sidebar({
		dimPage: false,
		transition: 'push',
		exclusive: true,
		closable: false
	});
	$('.ui.left.sidebar').sidebar('attach events', '#left-sidebar-toggle');
	
	// makes the option at the sidebar disappear on sidebar close
	$('#left-sidebar-toggle').on('click', function(){
		if(showOptions){
			$('#return-options').css({'-webkit-transform':'translate(0px, -329px)','transition':'transform 0.5s ease'}); // 65px:1block 5px:menu
			$('#query-details').css({'-webkit-transform':'translate(100px, 0px)','transition':'transform 0.5s ease'});
			$('#option-toggle').addClass('sidebar').removeClass('window close').transition({animation: 'flash', duration: '0.4s'});
		}
		else{
			$('#return-options').css({'-webkit-transform':'translate(0px, 0px)','transition':'transform 0.5s ease'});
			$('#query-details').css({'-webkit-transform':'translate(-500px, 0px)','transition':'transform 0.5s ease'});
			$('#option-toggle').addClass('window close').removeClass('sidebar').transition({animation: 'flash', duration: '0.4s'});
		}
		showOptions = !showOptions;
	});
	
	$('.menu .item').tab(); // enable semantic tab

	$('.ui.dropdown').dropdown(); // enable semantic dropdown

	$('.ui.checkbox').checkbox(); // enable semantic checkbox

	$('.message .close').on('click', function() { $(this).parent().transition('fade'); }); // initialize message close

	$('#chr-start').val(1);
	$('#chr-end').val(100);
	$('#INV').prop('checked', true); 

}

initialize();