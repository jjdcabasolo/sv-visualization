// Author: John Jourish DC. Abasolo
// Description: Implementation of the structural variant visualization using D3.js and jQuery

// GLOBAL CONSTANTS
// - file-related
// const fileDirRefGenome = 'data/IRGSP-1.0_genome.fa';
const fileDirRefGenome = 'data/dummyref.txt';
const fileDirSVDel = 'data/dummysv-del.txt';
// - svg-related
const svg = d3.select('#sv-visualization');
const svgTopMargin = 50; // in px
const svgLeftMargin = 20; // in px
const trackHeight = 15; // in px
const minimumRange = 10; // in bp
const flankingValue = 20; // in bp

// GLOBAL VARIABLES
let referenceGenome = [];
let structuralVariants = {};
let svToDraw = [];
let svFrequency = {};
let hotspotFrequency = {};
let noOfChr = 0;
let noOfClusters = 0;
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

	for(var i = 0; i < array.length; i++){
		let sv = array[i].split(/\t/g),
				typeLen = sv[3].split(/;/g), // [0] == type, [1] == length
				svObj = {};

		svObj['chrNum'] = Number(sv[0].replace(/chr/g, ''));
		svObj['start'] = Number(sv[1]);
		svObj['end'] = Number(sv[2]);
		svObj['length'] = Number(typeLen[1]);
		svObj['detail'] = sv[4];
		svObj['cluster'] = Number(sv[5]);

		svFrequency[typeLen[0]][Number(sv[5])] = 1 + (svFrequency[typeLen[0]][Number(sv[5])] || 0);
		structuralVariants[typeLen[0]][structuralVariants[typeLen[0]].length] = svObj;
	}
}

// draw the visualization on the SVG [D3] @ readTextFile()
function renderVisualization(){
	svg.selectAll('*').remove(); // clear svg
	addPopup();
	drawRuler();
	drawReferenceGenome();
	drawStructuralVariants();
	// enablePanAndZoom();
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
		        'Details' +
		        '<div class="detail" id="sv-label-detail-detail"></div>' +
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
	maxChrBound = currentChr.len * 7;

	chrSequence = setSequenceRange(chrSequence, true);

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

	$('#sv-visualization').attr('width', maxChrBound + (svgLeftMargin * 2) + (bpToPx(flankingValue) * 2) + rightAllowance); // adjusts the svg for it to be scrollable
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
				textInterval = chrStart - flankingValue - 1,
				interval = chrStart - bpToPx(flankingValue),
				intervalCount = Math.ceil((maxChrBound / 7) / rulerInterval) + 2,
				flank = bpToPx(flankingValue);

		if((maxChrBound / 7) % rulerInterval == 0){
			intervalCount = intervalCount + 1;
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
					.attr('stroke', 'black');

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
		    .style('pointer-events', 'none');		

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

	// // pattern on mmouse hover, code taken from: http://jsfiddle.net/yduKG/3/
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
	    .attr('stroke-width', 2);

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
		.style('fill', '#424242');

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
    .on('mouseout', trackMouseOut);
}

	// highlight effect on hover [D3] @ drawReferenceGenome()
	function trackMouseOver(){
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

	// @ drawReferenceGenome()
	function trackClick(){
		let startChr = Number($('#chr-start').val()),
				endChr = Number($('#chr-end').val()),
				chrNum = Number($('#chr-num-select').val()),
				svType = $('input[name=sv-type]:checked').val(),
				color = svToText(0), x, y;

		// make popup appear
		x = isSidebarOpen ? event.clientX - 380 : event.clientX - 120;
		y = event.clientY - 105;
		$('#popup-element').attr('x', x);
		$('#popup-element').attr('y', y);

		$('#sv-label').addClass(color);
		$('#sv-label-detail').text(svType);
		$('#sv-label-chr-detail').text(chrNum);
		$('#sv-label-start-detail').text($(this).attr('start') + ' bp');
		$('#sv-label-end-detail').text($(this).attr('end') + ' bp');
		$('#sv-label-cluster-detail').text($(this).attr('cluster'));
		$('#sv-label-detail-detail').text($(this).attr('detail'));
	}

function assignHotspotNumber(){
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
			hotspotCount = 0,
			svBranchHeight = 0;

	svToDraw[0]['hotspot'] = hotspotCount;
	svToDraw[0]['hotspotIndex'] = 0;
	hotspotFrequency[hotspotCount] = 1 + (hotspotFrequency[hotspotCount] || 0);
	svBranchHeight = hotspotFrequency[hotspotCount];

	for(var i = 1; i < svToDraw.length; i++){
		let nextSV = svToDraw[i];

		if(nextSV['start'] > maxBound){
			hotspotCount++;
		}
	
		if(nextSV['end'] >= maxBound || maxBound == nextSV['start'] || nextSV['start'] >= minBound || nextSV['end'] <= maxBound){
			maxBound = nextSV['end'];
				svToDraw[i]['hotspot'] = hotspotCount;
		}

		svToDraw[i]['hotspotIndex'] = (hotspotFrequency[hotspotCount] == null) ? 0 : hotspotFrequency[hotspotCount];
		hotspotFrequency[hotspotCount] = 1 + (hotspotFrequency[hotspotCount] || 0);
		if(svBranchHeight < hotspotFrequency[hotspotCount]){
			svBranchHeight = hotspotFrequency[hotspotCount];
		}
	}

	console.log(svToDraw);
	return svBranchHeight;
}

// draws the sv's within the specified range @ renderVisualization()
function drawStructuralVariants(){
	let svType = $('input[name=sv-type]:checked').val(),
			svClusters = Object.keys(svFrequency[svType]).length,
			refToSVSpace = 75, // in px
			bodyBGColor = $('.pusher').css('backgroundColor'),
			noOfmaxBranches = assignHotspotNumber(),
			rowsSVG = (noOfmaxBranches % 2) != 0 ? noOfmaxBranches - 1 : noOfmaxBranches, 
			flank = bpToPx(flankingValue),
			rightAllowance = bpToPx(10),
			wew = 0;

	rowsSVG = (trackHeight) * rowsSVG;

	// provides the bg color at the bottom of the pattern
	// draws the merged and continuous sv line
	svg
		.append('g')
			.attr('class', 'sv-merged-line')
		.append('rect')
			.attr('x', 0)
			.attr('y', svgTopMargin + refToSVSpace + rowsSVG)
			.attr('width', maxChrBound + svgLeftMargin + (flank * 2) + rightAllowance)
			.attr('height', trackHeight)
			.attr('trackID', 'reference-genome')
			.attr('color', '#ab1a25')
		.style('fill', '#ab1a25')
	;

  function locateYCoordinate(array){
  	let index = array[0],
  			maxCount = hotspotFrequency[array[1]],
		  	count = 0,
		  	flank = bpToPx(flankingValue), 
		  	x = bpToPx(array[3]) + 150,
		  	y = 0;
		  	// shearAngle = ((maxCount / 2) > index) ? -20 : 20;
		  	// startCoordinateAdjustmentX = ((maxCount / 2) > index) ? 26 : 24,
		  	// startCoordinateAdjustmentY = ((maxCount / 2) > index) ? 26 : -12,
		  	// endAngle = ((maxCount / 2) > index) ? 60 : -60;

  	if(maxCount == 1){
  		// for single-itemed hotspot
	  	return svgTopMargin + 75 + array[2];
  	}
  	else{
  		// for multiple-itemed hotspot
  		maxCount = maxCount - 1;
	  	count = Math.abs(index - maxCount) - (Math.floor(maxCount / 2));
	  	count = ((maxCount + 1) % 2 == 0) ? count - 1 : count; // to handle even number of hotspots, aligning to merged sv line
	  	count = (count < 0) ? Math.abs(count) + Math.floor(maxCount / 2) : count;
  	}
  	y = svgTopMargin + 75 + (Math.abs(count) * ((trackHeight) + 15));

  	// console.log(index +"index - y"+y+'x'+x);

  	// if(level sa branch){
  	// 	wew = x + 68;
  	// }
  	// if((maxCount / 2) >= index && index != 0){
	  // 	wew = (index == 1) ? x + 68 : wew - 30;
  	// }
  	// console.log(wew);

  	// if(y != (svgTopMargin + refToSVSpace + rowsSVG)){
			// svg
			// 	.append('g')
			// 		.attr('class', 'sv-merged-line')
			// 	.append('rect')
			// 		.attr('x', wew)
			// 		.attr('y', y)
			// 		.attr('width', trackHeight)
			// 		.attr('height', (15*((index*2))))
			// 		.attr('trackID', 'reference-genome')
			// 		.attr('transform', 'skewX('+shearAngle+')')
			// 		.attr('color', '#ab1a25')
			// 	.style('fill', '#ab1a25');

			// svg
			// 	.append('g')
			// 		.attr('class', 'sv-merged-line')
			// 	.append('rect')
			// 		.attr('x', span)
			// 		.attr('y', y)
			// 		.attr('width', trackHeight)
			// 		.attr('height', (15*((index*2))))
			// 		.attr('trackID', 'reference-genome')
			// 		.attr('transform', 'skewX('+(-shearAngle)+')')
			// 		.attr('color', '#ab1a25')
			// 	.style('fill', '#ab1a25');
  	// }

  	return y;
  }

  function isUpperOrLower(d, type, caseNumber){
  	let isUpper = d['hotspotIndex'] > (hotspotFrequency[d['hotspot']]/2);
  	if(d['hotspotIndex'] == 0){
  		return null;
  	}

  	switch(type){
  		case 'span':
		  	switch(caseNumber){
		  		case 1:
						if(isUpper){
				  		// return 0 + svgLeftMargin + flank + bpToPx(d['start']) - 150;
						}
			  		return 0 + svgLeftMargin + flank + bpToPx(d['start']) - 45;
			  		break;
		  		case 2:
						if(isUpper){
				  		// return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start']]) - (15 * (((d['hotspotIndex']+1) - Math.ceil(hotspotFrequency[d['hotspot']]/2)) * 2)) + 15;
						}
			  		return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start']]);
		  		case 3:
						if(isUpper){
							// return (trackHeight) * ((((d['hotspotIndex']+1) - Math.ceil(hotspotFrequency[d['hotspot']]/2))*2));
						}
						return bpToPx(d['length']) + 105;
		  			break;
		  		// case 4:
				  // 	if(isUpper){
				  // 		return 'skewX(20)';
				  // 	}
						// return 'skewX(-20)';
		  		// 	break;
		  	}
		  	break;

		  case 'out':
				switch(caseNumber){
		  		case 1:
						if(isUpper){
				  		return 0 + svgLeftMargin + flank + bpToPx(d['start']) - 150;
						}
			  		return 0 + svgLeftMargin + flank + bpToPx(d['start']);
			  		break;
		  		case 2:
						if(isUpper){
				  		return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start']]) - (15 * (((d['hotspotIndex']+1) - Math.ceil(hotspotFrequency[d['hotspot']]/2)) * 2)) + 15;
						}
			  		return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start']]);
		  		case 3:
						if(isUpper){
							return (trackHeight) * ((((d['hotspotIndex']+1) - Math.ceil(hotspotFrequency[d['hotspot']]/2))*2));
						}
						return (trackHeight) * ((d['hotspotIndex']*2) );
		  			break;
		  		case 4:
				  	if(isUpper){
				  		return 'skewX(20)';
				  	}
						return 'skewX(-20)';
		  			break;
		  	}
		  	break;

		  case 'in':
			  switch(caseNumber){
		  		case 1:
						if(isUpper){
				  		return 0 + svgLeftMargin + flank + bpToPx(d['end']) + 150;
						}
			  		return 0 + svgLeftMargin + flank + bpToPx(d['end']);
			  		break;
		  		case 2:
						if(isUpper){
				  		return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['end']]) - (30 * (((d['hotspotIndex']+1) - Math.ceil(hotspotFrequency[d['hotspot']]/2)) )) + 15;
						}
			  		return locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['end']]);
		  		case 3:
						if(isUpper){
							return (trackHeight) * ((((d['hotspotIndex']+1) - Math.ceil(hotspotFrequency[d['hotspot']]/2))*2));
						}
						return (trackHeight) * ((d['hotspotIndex']*2) );
		  			break;
		  		case 4:
				  	if(isUpper){
							return 'skewX(-20)';
				  	}
			  		return 'skewX(20)';
		  			break;
		  	}
		  	break;
  	}
  }

  function formVertices(d){  	
  	console.log(d);
		let string = '',
				base = svgTopMargin + refToSVSpace + rowsSVG + 7.5,
				y = locateYCoordinate([d['hotspotIndex'], d['hotspot'], rowsSVG, d['start']]) + 7.5,
				xStart = bpToPx(d['start']) + 100,
				xEnd = xStart + bpToPx(d['length']) + 100,
				offset = 10 + ((d['hotspotIndex'] - 1) * 9);

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
		.append('polygon')
			.attr('points', function(d){ return formVertices(d) })
		.style('fill', 'none')
		.style('stroke', '#ab1a25')
		.style('stroke-width', trackHeight)
  ;

	// svg
	// 	.selectAll('sv-branch-out')		
	// 	.data(svToDraw)
	// 		.enter()
	// 	.append('rect')
	// 		.attr('x', function(d){ return isUpperOrLower(d, 'out', 1) })
	// 		.attr('y', function(d){ return isUpperOrLower(d, 'out', 2) })
	// 		.attr('width', trackHeight)
	// 		.attr('height', function(d){ return isUpperOrLower(d, 'out', 3) })
	// 		.attr('transform', function(d){ return isUpperOrLower(d, 'out', 4) })
	// 		.attr('color', '#ab1a25')
	// 	.style('fill', '#ab1a25');

	// svg
	// 	.selectAll('sv-branch-in')		
	// 	.data(svToDraw)
	// 		.enter()
	// 	.append('rect')
	// 		.attr('x', function(d){ return isUpperOrLower(d, 'in', 1) })
	// 		.attr('y', function(d){ return isUpperOrLower(d, 'in', 2) })
	// 		.attr('width', trackHeight)
	// 		.attr('height', function(d){ return isUpperOrLower(d, 'in', 3) })
	// 		.attr('transform', function(d){ return isUpperOrLower(d, 'in', 4) })
	// 		.attr('color', '#ab1a25')
	// 	.style('fill', '#ab1a25');

 //  svg
	// 	.selectAll('sv-branch-span')		
	// 	.data(svToDraw)
	// 		.enter()
	// 	.append('rect')
	// 		.attr('x', function(d){ return isUpperOrLower(d, 'span', 1) })
	// 		.attr('y', function(d){ return isUpperOrLower(d, 'span', 2) })
	// 		.attr('width', function(d){ return isUpperOrLower(d, 'span', 3)} )
	// 		.attr('height', trackHeight )
	// 		// .attr('transform', function(d){ return isUpperOrLower(d, 'span', 4) })
	// 		.attr('color', '#ab1a25')
	// 	.style('fill', '#ab1a25');
	
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
			.attr('color', 'red')
			.attr('start', function(d) { return d['start'] })
			.attr('end', function(d) { return d['end'] })
			.attr('cluster', function(d) { return d['cluster'] })
			.attr('detail', function(d) { return d['detail'] })
		.style('fill', 'red')
		.on('mouseover', trackMouseOver)
    .on('mouseout', trackMouseOut)
    .on('click', trackClick)
  ;
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

// event listeners for html elements [jQuery] @ initialize()
function initializeActionListeners(){
	// reloads the visualization on chr change
	$('#chr-num-select').on('change', function(){
		let chrNum = Number($('#chr-num-select').val()) - 1,
				currentChr = referenceGenome[chrNum];

		$('#max-count').text(currentChr.len);
	});

	// toggles the sequence text
	$('#toggle-seq-text').on('change', function(){
		svg.selectAll('.sequence-text').remove(); // removes the sequence text

		let chrNum = Number($('#chr-num-select option:selected').val()) - 1,
				currentChr = referenceGenome[chrNum],
				chrSequence = currentChr.seq.toUpperCase();

		if($('#toggle-seq-text').is(':checked') === true){
			showSequence = false;
		}
		else{
			showSequence = true;	
		}

		addSequenceText(setSequenceRange(chrSequence, false));
	});

	$('#ruler-interval').on('change', function(){
		svg.selectAll('.ruler').remove(); // removes the whole ruler
		drawRuler();
	});

	$('#left-sidebar-toggle').on('click', function(){
		isSidebarOpen = !isSidebarOpen;
		if(isSidebarOpen){
			$('#svg-holder').css('width', '78%');  // TODO: responsive width
		}
		else{
			$('#svg-holder').css('width', '98%'); 
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

	$('#chr-coordinates').click(function(){
		$('#svg-holder').css('width', '78%'); // adjusts the svg view at start // TODO: responsive width

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
			];

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

	// set the attributes of the svg
	$('#sv-visualization').attr('height', '500px');
	$('#sv-visualization').attr('width', '100%');
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
			$('#return-options').css({'-webkit-transform':'translate(0px, -330px)'}); // 65px:1block 5px:menu
			$('#option-toggle').addClass('sidebar').removeClass('window close').transition({animation: 'flash', duration: '0.4s'});
		}
		else{
			$('#return-options').css({'-webkit-transform':'translate(0px, 0px)'});
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
	$('#DEL').prop('checked', true); 



}

initialize();