// Author: John Jourish DC. Abasolo
// Description: Implementation of the structural variant visualization using D3.js and jQuery

// GLOBAL CONSTANTS
// - file-related
// const fileDirRefGenome = 'data/IRGSP-1.0_genome.fa';
const fileDirRefGenome = 'data/dummyref.txt';
const fileDirSVDel = 'data/dummysv-del.txt';
// const fileDirSVDel = 'data/dummysv-ins.txt';
// - svg-related
const svg = d3.select('#sv-visualization');
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
let svToDraw = {};
let svFrequency = {};
let hotspotFrequency = {};
let noOfChr = 0;
let noOfClusters = 0;
let flankingValue = 20; // in bp
let startChr = 0; // in bp
let endChr = 0; // in bp
let rowInSVG = 0;
// - svg-related
let maxChrBound = 0;
let rulerInterval = 20; // in px
let showSequence = true;
let nightMode = false;
let brush;
let panZoomSVG = null;
let zoomToggle = false;
let brushToggle = false;
let panToggle = false;
// - ui-related
let showOptions = true;
let isSidebarOpen = true;
let typeSize = [0, 0, 0, 0];

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
				typeLen = (isDelDupInv) ? sv[3].split(/;/g) : ['INS', '1']; // [0] == type, [1] == length
				svObj = {};

		svObj['chrNum'] = Number(sv[0].replace(/chr/g, ''));
		svObj['start'] = Number(sv[1]);
		svObj['end'] = Number(sv[2]);
		svObj['length'] = Number(typeLen[1]);
		svObj['type'] = typeLen[0];
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
	
	// helpers
	setDetailsOnSubMenu(); // details on top of the visualization when sidebar is closed
	addPopup(); // adds the pop-up that appears when DEL, INV, DUP is clicked
	
	// ruler
	drawRuler();

	// reference genome
	drawReferenceGenome();

	var rowInSVG = prepareTypeSpacing(),
			variants = Object.keys(svToDraw),
			index = 0
	;

	// structural variants
	for(var i = 0; i < variants.length; i++){
		if(svToDraw[variants[i]].length > 0){
			drawStructuralVariants(typeSize[index], rowInSVG, variants[i]);
			index++;
		}
	}

	// pan and zoom
	initializePanAndZoom();
}

// sets detail on sub menu (appears when sidebar is closed) @ renderVisualization()
function setDetailsOnSubMenu(){
	let startChr = Number($('#chr-start').val()),
			endChr = Number($('#chr-end').val()),
			chrNum = Number($('#chr-num-select').val())
	;

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
			.attr('width', 500)
	;

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
				color = svToText(0), x, y
		;

		// make popup appear
		x = isSidebarOpen ? event.clientX - 400 : event.clientX - 120;
		y = event.clientY - 80;
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

		$('#sv-ins-details').modal('show');

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
	let minBound = svToDraw[type][0]['start'],
			maxBound = svToDraw[type][0]['end'],
			svBranchHeight = 0,
			hotspotCount = 0
	;

	svToDraw[type][0]['hotspot'] = hotspotCount;
	svToDraw[type][0]['hotspotIndex'] = 0;
	hotspotFrequency[type][hotspotCount] = 1 + (hotspotFrequency[type][hotspotCount] || 0);
	svBranchHeight = hotspotFrequency[type][hotspotCount];

	// console.log('start:' + svToDraw[type][0]['start'] + ' end:' + svToDraw[type][0]['end'] + ' stackNo:' + svToDraw[type][0]['hotspot'] + ' index:' + svToDraw[type][0]['hotspotIndex']);
	for(var i = 1; i < svToDraw[type].length; i++){
		let nextSV = svToDraw[type][i];

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
				svToDraw[type][i]['hotspot'] = hotspotCount;
			}
		}
		else{
			if(nextSV['end'] == maxBound || nextSV['start'] == minBound ){
				svToDraw[type][i]['hotspot'] = hotspotCount;
			}				
		}

		svToDraw[type][i]['hotspotIndex'] = (hotspotFrequency[type][hotspotCount] == null) ? 0 : hotspotFrequency[type][hotspotCount];
		hotspotFrequency[type][hotspotCount] = 1 + (hotspotFrequency[type][hotspotCount] || 0);
		if(svBranchHeight < hotspotFrequency[type][hotspotCount]){
			svBranchHeight = hotspotFrequency[type][hotspotCount];
		}

		// console.log('start:' + svToDraw[type][i]['start'] + ' end:' + svToDraw[type][i]['end'] + ' stackNo:' + svToDraw[type][i]['hotspot'] + ' index:' + svToDraw[type][i]['hotspotIndex']);
	}

	return svBranchHeight;
}

// computes the spacing for each sv-type to be visualized on the 
function prepareTypeSpacing(){
	let svType = [],
			noOfmaxBranches = 0,
			rowsSVG = 0,
			adjustedRowsSVG = 0 
	;

	hotspotFrequency = {'INS':{}, 'DEL':{}, 'INV':{}, 'DUP':{}};

	$('#sv-checkboxes input:checked').each(function(){
		// gets all the checked checkboxes
		svType.push($(this).attr('id'));
	});

	for (var i = 0; i < svType.length; i++) {
		var newNoOfmaxBranches = assignHotspotNumber(svType[i]);
		if(newNoOfmaxBranches > noOfmaxBranches){
			noOfmaxBranches = newNoOfmaxBranches;
		}
	}

	rowsSVG = (noOfmaxBranches % 2) != 0 ? noOfmaxBranches - 1 : noOfmaxBranches;
	adjustedRowsSVG = (trackHeight) * rowsSVG;

	typeSize[0] = 50 + bpToPx(rowsSVG); // spsce between reference genome and the first svtype visualization
	for (var i = 1; i < 4; i++) { // for the remaining three
		typeSize[i] = (typeSize[0] * (i+1)); // considers the number of branches on an svtype visualization
	}

	// change svg size 
	$('#sv-visualization').attr('height', rowsSVG * 100);

	return adjustedRowsSVG;
}

// draws the sv's within the specified range @ renderVisualization()
function drawStructuralVariants(int, rowsSVG, svType){
	let svClusters = Object.keys(svFrequency[svType]).length,
			refToSVSpace = int, // in px
			bodyBGColor = $('.pusher').css('backgroundColor'),
			flank = bpToPx(flankingValue),
			rightAllowance = bpToPx(10)
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
	  			maxCount = hotspotFrequency[array[4]][array[1]], // number of branches 
			  	count = 0,
			  	flank = bpToPx(flankingValue), 
			  	x = bpToPx(array[3]) + 150,
			  	y = 0,
			  	trackIntervalHeight = 5,
			  	trackToMergedLine = 50
			;

	  	if(maxCount == 1){
	  		// for single-itemed hotspot
		  	return svgTopMargin + (refToSVSpace - 50) + trackToMergedLine + rowsSVG;
	  	}
	  	else{
	  		// for multiple-itemed hotspot
	  		maxCount = maxCount - 1;
		  	count = Math.abs(index - maxCount) - (Math.floor(maxCount / 2));
		  	if((maxCount % 2) != 0){
			  	count = (count < 0) ? Math.abs(count) + Math.floor(maxCount / 2) + 1 : count;
		  	}
		  	else{
			  	count = (count < 0) ? Math.abs(count) + Math.floor(maxCount / 2) : count;
		  	}

	  	}
	  	y = svgTopMargin + (refToSVSpace - 50) + trackToMergedLine + (Math.abs(count) * ((trackHeight) + trackIntervalHeight));

	  	return y;
	  }

	  // forms the vertices of the DEL/DUP/INV track (rectangle on branch) @ svg.polyline.sv-branch
	  function formVertices(d){  	
			let string = '',
					yFactor = 2.5,
					base = svgTopMargin + refToSVSpace + rowsSVG + yFactor,
					y = locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start'], d['type']]) + yFactor,
					xStart = bpToPx(d['start']) + bpToPx(flankingValue) - 50,
					xEnd = xStart + bpToPx(d['length']) + bpToPx(flankingValue) - 50,
					offset = 10 + ((d['hotspotIndex'] - 1) * 9)
			;

			// makes the branching angle of each branches equal no matter the y position
	  	if(d['hotspotIndex'] > (hotspotFrequency[d['type']][d['hotspot']] / 2)){
	  		let indexFix = (d['hotspotIndex'] + 1) - Math.ceil(hotspotFrequency[d['type']][d['hotspot']] / 2);
	  		if((hotspotFrequency[d['type']][d['hotspot']] % 2) == 0){ 
	  			indexFix--; // adjustment fix for even number of branches
	  		}
				offset = 10 + ((indexFix - 1) * 9);
	  	}

			if(d['hotspotIndex'] != 0){
				string = (xStart - offset) + ',' + base + ' ';
				string = string + xStart + ',' + y + ' ';
				string = string + xEnd + ',' + y + ' ';
				string = string + (xEnd + offset) + ',' + base + ' ';
			}

			return string;
	  }

	  // draws the polyline (trapezoidal manner) for the branches of the structural variants
		svg
			.selectAll('sv-branch')		
			.data(svToDraw[svType])
				.enter()
			.append('polyline')
				.attr('points', function(d){ return formVertices(d) })
				.attr('color', '#ab1a25')
			.style('fill', 'none')
			.style('stroke', '#ab1a25')
			.style('stroke-width', trackHeight)
			// .on('mouseover', refMouseOver)
	  	// .on('mouseout', refMouseOut)
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
					.data(svToDraw[svType])
						.enter()
					.append('line')
						.attr('x1', function(d){ return 0 + svgLeftMargin + flank + bpToPx(d['start']) } )
						.attr('x2', function(d){ return 0 + svgLeftMargin + flank + bpToPx(d['start']) + 8 } )
						.attr('y1', function(d){ return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start'], d['type']]) + 2 } )
						.attr('y2', function(d){ return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start'], d['type']]) - 4 } )
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
					.data(svToDraw[svType])
						.enter()
					.append('line')
						.attr('x1', function(d){ return 0 + svgLeftMargin + flank + bpToPx(d['start']) } )
						.attr('x2', function(d){ return 0 + svgLeftMargin + flank + bpToPx(d['start']) + 8 } )
						.attr('y1', function(d){ return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start'], d['type']]) + 2 } )
						.attr('y2', function(d){ return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start'], d['type']]) + 8 } )
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
			.data(svToDraw[svType])
				.enter()
			.append('rect')
				.attr('x', function(d){ return 0 + svgLeftMargin + flank + bpToPx(d['start']) } )
				.attr('y', function(d){ return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start'], d['type']])} )
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
			.data(svToDraw[svType])
				.enter()
			.append('polygon')
				.attr('points', function(d){ return formVertices(d) } )
				.attr('color', 'black')
			.style('fill', 'black')
	  ;

		svg
			.selectAll('sv-stack')		
			.data(svToDraw[svType])
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

// makes the fill of the track turn into a diagonal hatch [D3] @ drawReferenceGenome()
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

// removes the brush @ setupSemantic()
function removeBrush(){
	svg.selectAll('.brush').remove(); // clear brush	
}

function brushed(){
	let brushStart = Number($('.handle--w').attr('x')) + 3,
			brushEnd = Number($('.handle--e').attr('x')) + 3
	;

	// if($(selection))
// $(this).replaceWith($('<h5>' + this.innerHTML + '</h5>'));
	console.log('start:' + brushStart);
	console.log('end:' + brushEnd);
}

function brushended(){
	// console.log('wewewweewe');
  // if (!d3.event.sourceEvent) return; // Only transition after input.
  // if (!d3.event.selection) return; // Ignore empty selections.
  // var d0 = d3.event.selection.map(x.invert),
  //     d1 = d0.map(d3.timeDay.round);

  // // If empty when rounded, use floor & ceil instead.
  // if (d1[0] >= d1[1]) {
  //   d1[0] = d3.timeDay.floor(d0[0]);
  //   d1[1] = d3.timeDay.offset(d1[0]);
  // }

  // d3.select(this).transition().call(d3.event.target.move, d1.map(x));
}

// draws a brush on top of the sv visualization @ setupSemantic()
function drawBrush(rowsSVG){
	let chrStart = Number($('#chr-start').val()),
			chrEnd = Number($('#chr-end').val()),
			flank = bpToPx(flankingValue),
			startPx = flank + svgLeftMargin,
			endPx = bpToPx(chrEnd - chrStart) + startPx + 7
	;

	brush = d3
		.brushX()
	  	.extent([[startPx, 30], [endPx, 300]])
   	.on('brush', brushed)
	  .on('end', brushended)
  ;

	svg
		.append('g')
    	.attr('class', 'x brush')
	    .call(brush)
  ;
}

// initialize pan and zoom for the whole SVG [jQuery plugin] @ renderVisualization()
function initializePanAndZoom(){
	if(!panZoomSVG == null)	panZoomSVG.destroy();

	panZoomSVG = svgPanZoom('#sv-visualization', {
		panEnabled: false,
		zoomEnabled: false,
		dblClickZoomEnabled: false,
		mouseWheelZoomEnabled: false,
		preventMouseEventsDefault: true,
		zoomScaleSensitivity: 0.12,
		minZoom: 0.1,
		maxZoom: 5,
		fit: false,
		contain: false,
		center: false
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

			if(brushToggle){
				changeToolState('#brush-icon', 'brush', 'check', '#brush-toggle');
				removeBrush();
				brushToggle = false;
				
				// shows the brush tools
				$('#brush-tools').css({
					'-webkit-transform':'translate(-800px, 0px)',
					'transition':'transform 0.5s ease'
				});
			}

			if(panToggle){ // disables the pan on brush use
				changeToolState('#pan-icon', 'hand pointer', 'check', '#pan-toggle');
				panZoomSVG.disablePan(); // disable pan
				panToggle = false;
			}

			if(zoomToggle){ // disables the zoom in brush use
				changeToolState('#zoom-icon', 'zoom', 'check', '#zoom-toggle');
				panZoomSVG.disableDblClickZoom(); // disable double click zoom
				panZoomSVG.disableZoom(); // disable zoom

				// hides the brush tools
				$('#zoom-tools').css({
					'-webkit-transform':'translate(-800px, 0px)',
					'transition':'transform 0.5s ease'
				});

				zoomToggle = false;
			}

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
		let startChr = Number($('#chr-start').val()) - 1,
				endChr = Number($('#chr-end').val()) - 1,
				maxBound = Number($('#max-count').text()),
				errorRange = false, errorSV = false,
				svType = []
		;

		$('#sv-checkboxes input:checked').each(function(){
			// gets all the checked checkboxes
			svType.push($(this).attr('id'));
		});

		$('#svg-holder').css('width', '95%'); // adjusts the svg view at start // TODO: responsive width
		
		// bounds
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
				svType = '',
				flag = 0,
				keys = []
		;

		svToDraw = filterSV();
		keys = Object.keys(svToDraw);

		for(var i = 0; i < keys.length; i++){
			if(svToDraw[keys[i]].length != 0){
				flag = 1;
				break;
			}
		}

		if(flag == 0){
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
					svType = [],
					chrNum = Number($('#chr-num-select option:selected').val()),
					svArray = [],
					returnArray = [],
					svToDraw = {'INS':[], 'DEL':[], 'INV':[], 'DUP':[]}
			;

			$('#sv-checkboxes input:checked').each(function(){
				// gets all the checked checkboxes
				svType.push($(this).attr('id'));
			});

			for (var j = 0; j < svType.length; j++) {
				svArray = structuralVariants[svType[j]];
				for(var i = 0; i < svArray.length; i++){
					if(svArray[i]['type'] == svType[j]){
						let start = svArray[i]['start'],
								end = svArray[i]['end'],
								num = svArray[i]['chrNum'];

						if(startChr <= start && endChr >= end && chrNum == num){
							returnArray[returnArray.length] = svArray[i];
						}
					}
				}

				svToDraw[svType[j]] = returnArray;
				returnArray = [];
			}

			return svToDraw;
		}

// returns the sv-related info, index == 0, color; index == 1, type
function svToText(index){
	let svType = [],
			svString = '',
			names = [
				['teal', 'blue', 'violet', 'purple'],
				['deletions', 'inversions', 'duplications', 'insertions'],
			]
	;

	$('#sv-checkboxes input:checked').each(function(){
		// gets all the checked checkboxes
		svType.push($(this).attr('id'));
	});

	for(var i = 0; i < svType.length; i++){
		switch(svType[i]){
	    case 'DEL':
        svString = svString + names[index][0] + ', ';
        break;
	    case 'INV':
        svString = svString + names[index][1] + ', ';
        break;
	    case 'DUP':
        svString = svString + names[index][2] + ', ';
        break;
	    case 'INS':
        svString = svString + names[index][3] + ', ';
        break;
	    default:
        svString = 'magical SV\'s';
		}
	}

	return svString;
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

	$('#query-details').css({'-webkit-transform':'translate(-800px, 0px)'});
	$('#zoom-tools').css({'-webkit-transform':'translate(-800px, 0px)'});
	$('#brush-tools').css({'-webkit-transform':'translate(-800px, 0px)'});
}

function changeToolState(iconID, addClassID, removeClassID, buttonID){
	$(iconID)
		.addClass(addClassID)
		.removeClass(removeClassID)
		.transition({
			animation: 'flash',
			duration: '0.2s'
		});
	$(buttonID).removeClass('active');
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
			$('#return-options').css({
				'-webkit-transform':'translate(0px, -329px)',
				'transition':'transform 0.5s ease'
			}); // 65px:1block 5px:menu
			$('#query-details').css({
				'-webkit-transform':'translate(100px, 0px)',
				'transition':'transform 0.5s ease'
			});
			$('#option-toggle')
				.addClass('sidebar')
				.removeClass('window close')
				.transition({
					animation: 'flash',
					duration: '0.4s'
				});
		}
		else{
			$('#return-options').css({
				'-webkit-transform':'translate(0px, 0px)',
				'transition':'transform 0.5s ease'
			});
			$('#query-details').css({
				'-webkit-transform':'translate(-800px, 0px)',
				'transition':'transform 0.5s ease'
			});	
			$('#option-toggle')
				.addClass('window close')
				.removeClass('sidebar')
				.transition({
					animation: 'flash',
					duration: '0.4s'
				});
		}
		showOptions = !showOptions;
	});

	// assign tools on zoom tool
	$('#reset-toggle').on('click', function(){
		panZoomSVG.reset();
	});

	$('#fit-toggle').on('click', function(){
		panZoomSVG.fit();
	});

	$('#zoom-in-toggle').on('click', function(){
		panZoomSVG.zoomIn();
	});

	$('#zoom-out-toggle').on('click', function(){
		panZoomSVG.zoomOut();
	});

	$('#zoom-toggle').on('click', function(){
		if(zoomToggle){
			changeToolState('#zoom-icon', 'zoom', 'check', '#zoom-toggle');

			// hides the zoom tools
			$('#zoom-tools').css({
				'-webkit-transform':'translate(-800px, 0px)',
				'transition':'transform 0.5s ease'
			});

			panZoomSVG.disableDblClickZoom(); // disable double click zoom
			panZoomSVG.disableZoom(); // disable zoom
 		}
		else{
			changeToolState('#zoom-icon', 'check', 'zoom', '#zoom-toggle');

			// disables brush on zoom use
			if(brushToggle){
				changeToolState('#brush-icon', 'brush', 'check', '#brush-toggle');
				removeBrush();
				brushToggle = false;

				// shows the brush tools
				$('#brush-tools').css({
					'-webkit-transform':'translate(-800px, 0px)',
					'transition':'transform 0.5s ease'
				});

			}

			// shows the zoom tools
			$('#zoom-tools').css({
				'-webkit-transform':'translate(514px, 0px)',
				'transition':'transform 0.5s ease'
			});

			panZoomSVG.enableDblClickZoom(); // enable double click zoom
			panZoomSVG.enableZoom(); // enable zoom
		}
		zoomToggle = !zoomToggle;
	});

	$('#pan-toggle').on('click', function(){
		if(panToggle){
			changeToolState('#pan-icon', 'hand pointer', 'check', '#pan-toggle');
			panZoomSVG.disablePan(); // disable pan
 		}
		else{
			changeToolState('#pan-icon', 'check', 'hand pointer', '#pan-toggle');

			// disables brush on pan use
			if(brushToggle){
				changeToolState('#brush-icon', 'brush', 'check', '#brush-toggle');
				removeBrush();
				brushToggle = false;

				// shows the brush tools
				$('#brush-tools').css({
					'-webkit-transform':'translate(-800px, 0px)',
					'transition':'transform 0.5s ease'
				});
			}

			panZoomSVG.enablePan(); // enable pan
		}
		panToggle = !panToggle;
	});

	$('#brush-toggle').on('click', function(){
		if(brushToggle){
			changeToolState('#brush-icon', 'brush', 'check', '#brush-toggle');
			removeBrush();
			
			// shows the brush tools
			$('#brush-tools').css({
				'-webkit-transform':'translate(-800px, 0px)',
				'transition':'transform 0.5s ease'
			});
		}
		else{
			changeToolState('#brush-icon', 'check', 'brush', '#brush-toggle');
			
			// with the brush active, you cannot use zoom and pan. just deal with it.
			if(panToggle){ // disables the pan on brush use
				changeToolState('#pan-icon', 'hand pointer', 'check', '#pan-toggle');
				panZoomSVG.disablePan(); // disable pan
				panToggle = false;
			}

			if(zoomToggle){ // disables the zoom in brush use
				changeToolState('#zoom-icon', 'zoom', 'check', '#zoom-toggle');
				panZoomSVG.disableDblClickZoom(); // disable double click zoom
				panZoomSVG.disableZoom(); // disable zoom

				// hides the brush tools
				$('#zoom-tools').css({
					'-webkit-transform':'translate(-800px, 0px)',
					'transition':'transform 0.5s ease'
				});

				zoomToggle = false;
			}
			
			// shows the zoom tools
			$('#brush-tools').css({
				'-webkit-transform':'translate(682px, 0px)',
				'transition':'transform 0.5s ease'
			});

			panZoomSVG.reset(); // resets the view
			drawBrush(rowInSVG);
		}
		brushToggle = !brushToggle;
	});
		
	$('#show-table-toggle').on('click', function(){
		if(!($('rect.selection').attr('width') === undefined)){
			$('#sv-modal-table').modal('show');

			$('.remove-table').remove();
			$('.remove-actions').remove();

			var keys = Object.keys(svToDraw),
					copySV = JSON.parse(JSON.stringify(svToDraw)),
					arrayOfObjects, htmlTag
			;

			for(var i = 0; i < keys.length; i++){
				arrayOfObjects = copySV[keys[i]];
				for (var j = 0; j < arrayOfObjects.length; j++) {
					delete arrayOfObjects[j]['hotspotIndex']; 
					delete arrayOfObjects[j]['hotspot']; 
				}
				if(arrayOfObjects.length > 0){
					// adds header for each table
					arrayOfObjects.unshift({
						'chrNum': 'Chr. No.',
						'start': 'Start',
						'end': 'End',
						'length': 'Length',
						'type': 'Type',
						'sampleID': 'SampleID',
						'cluster': 'Cluster',
					});
					
					// add buttons for table exporting
			  	htmlTag = 
			      '<div class="actions remove-actions">' + 
					  	'<div class="ui inverted button export-csv" id="csv' + keys[i] + '">' +
			          'Export to CSV' +
			        '</div>' +
			        '<div class="ui inverted button export-tsv" id="tsv' + keys[i] + '">' +
			          'Export to TSV' +
			        '</div>' +
			        '<div class="ui inverted button export-bed" id="bed' + keys[i] + '">' +
			          'Export to BED' +
			        '</div>' + 
		        '</div>';
					$('#sv-modal-table').append(htmlTag);
				}

				$.jsontotable(copySV[keys[i]], { id: '#sv-modal-table', header: true, className: 'ui selectable celled padded table remove-table ' + keys[i] });
			}

			initializeTableExportButtons();
		}
	});

	$('#brush-adjust').on('click', function(){
		let brushStart = Number($('#brush-start').val()),
				brushEnd = Number($('#brush-end').val())
		;

		console.log(brushStart);
		console.log(brushEnd);
	});

	// set-up the export button
	$('#screenshot').on('click', function(){
		saveSvgAsPng(document.getElementById('sv-visualization'), 'sv-visualization.png', {backgroundColor: 'white'});
	});

	$('.menu .item').tab(); // enable semantic tab

	$('.ui.dropdown').dropdown(); // enable semantic dropdown

	$('.ui.checkbox').checkbox(); // enable semantic checkbox

	$('#brush-options-toggle').popup({
		on: 'click'
	});

	$('.message .close').on('click', function(){
		$(this).parent().transition('fade');
	}); // initialize message close

	// automation
	$('#chr-start').val(1);
	$('#chr-end').val(100);
	// $('#INS').prop('checked', true); 
	$('#INV').prop('checked', true); 
	// $('#DUP').prop('checked', true); 
	$('#DEL').prop('checked', true); 
}

function initializeTableExportButtons(){
	function formStringSaveFile(tag, separator, fileType){
		var type = tag.id.replace(fileType, ''),
				keys = Object.keys(svToDraw),
				copySV = JSON.parse(JSON.stringify(svToDraw)),
				arrayOfObjects = copySV[type],
				fields, array = []
		;

		console.log(arrayOfObjects);
		arrayOfObjects.shift();
		console.log(arrayOfObjects);
		for (var j = 0; j < arrayOfObjects.length; j++) {
			delete arrayOfObjects[j]['hotspotIndex']; 
			delete arrayOfObjects[j]['hotspot']; 
		}
		fields = Object.keys(arrayOfObjects[0]);

		var replacer = function(key, value) { return value === null ? '' : value } 
		var data = arrayOfObjects.map(function(row){
		  return fields.map(function(fieldName){
		    return JSON.stringify(row[fieldName], replacer)
		  }).join(separator)
		})

		data.unshift(fields.join(separator)) // add header column
		array.push(data.join('\r\n'));

		var file = new File(array, 'sv' + type + '.' + fileType + '', {type: 'text/plain;charset=utf-8'});
		saveAs(file);
	}

	$('.export-csv').on('click', function(){
		formStringSaveFile(this, ',', 'csv');
	});

	$('.export-tsv').on('click', function(){
		formStringSaveFile(this, '\t', 'tsv');
	});
}

initialize();