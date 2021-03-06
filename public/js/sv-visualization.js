// Author: John Jourish DC. Abasolo
// Description: Implementation of the structural variant visualization using D3.js and jQuery

		// GLOBAL CONSTANTS
		// - file-related
    const fileRef = './db/ref/raw/IRGSP-1.0_genome.fa';
    const fileSVIns = './db/sv/raw/NB_INS_mergesam_hclust.bed';
    const fileSVDel = './db/sv/raw/NB_DEL_mergesam_hclust.bed';
    const fileSVDup = './db/sv/raw/NB_DUP_mergesam_hclust.bed';
    const fileSVInv = './db/sv/raw/NB_INV_mergesam_hclust.bed';
    const fileGene = './db/gene/raw/all_intron.gff3';
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
		const isRealData = false;		

		// GLOBAL VARIABLES
		var referenceGenome = [];
		var structuralVariants = {};
		var svToDraw = {};
		var svToTable = {};
		var svFrequency = {};
		var hotspotFrequency = {};
		var noOfChr = 0;
		var noOfClusters = 0;
		var flankBp = 0; // in bp
		var startChrBp = 0; // in bp
		var endChrBp = 0; // in bp
		var chrNum = 0;
		var rowInSVG = 0;
		var startBrushPx = 0;
		var endBrushPx = 0;
		var startBrushBp = 0; // in bp
		var endBrushBp = 0; // in bp
		var copySV = {};
		// - svg-related
		var chrLength = 0;
		var rulerInterval = 20; // in px
		var showSequence = true;
		var showGrid = false;
		var nightMode = false;
		var brush = '';
		var panZoomSVG = null;
		var zoomToggle = false;
		var brushToggle = false;
		var panToggle = false;
		var brushHeight = 300; // in px
		// - ui-related
		var showOptions = true;
		var isSidebarOpen = true;
		var typeSize = [0, 0, 0, 0];

		// initialization
		function initialize(){
			// $('body').dimmer('show');
			countChromosomes();
			initializeSetCoordinates();
			initializeActionListeners();
			changeHTMLDOM();
			setupVisualizationTools();
		}

		// counts the chromosomes present on the FASTA file by checking if it exists or not via getting its length
		function countChromosomes(){
			// adds the chromosomes identified on the FASTA file to the dropdown at the query section
			function addChrToDropdown(data){
				var chrTag = '',
						chrNum = data.replace(/^\D+/g, '');
				chrTag = chrTag + '<option value=' + chrNum + '> chr ' + chrNum + '</option>';
				$('#chr-num-select').append(chrTag);
			}

			if(isRealData){
				// Capped with the species that has the maximum number of chromosomes, Ophioglossum (fern)
				// that has 1260 chromosomes. Taken from https://www.quora.com/What-animal-has-the-largest-number-of-chromosomes
				const maxNumOfChr = 1260;
				var stop = false, i = 1;

				var getLength = setInterval(function(){
					var rname = 'chr';

					if(i < 10) rname = rname + '0';
					rname = rname + i;

					$.ajax({
						cache: false,
						type: 'get',
						url: '/ref/chr/length',
						data: {
							'chr': rname
						}
					}).done(function(data) {
						if(data == 0){
							clearInterval(getLength);
							
							// sorts the added chromsomes at the dropdown (unsorted intially due to its asynchronous nature)
							// taken from https://stackoverflow.com/a/7466196
							$('#chr-num-select').html(
								$('#chr-num-select option').sort(function (a, b) {
									return a.text == b.text ? 0 : a.text < b.text ? -1 : 1
								})
							); 

							// default select chromosome 1
							$('#chr-num-select').val('01');

							// update the chromsome length
							retrieveDataFromDB('ref-chr-length', function (data){
								$('#max-count').text(data);
							});
						}
						else{
							addChrToDropdown(rname);
						}
					});

					i++;
				}, 10);
			}
			else{
				// for the reference genome dummy data
				addChrToDropdown('chr 01');
				addChrToDropdown('chr 02');
				addChrToDropdown('chr 03');
				$('#max-count').text(1080);
			}
		}

		function retrieveDataFromDB(type, callback){
			var chrNum = Number($('#chr-num-select').val());
					rname = 'chr';

			if(chrNum < 10) rname = rname + '0';
			rname = rname + chrNum;

			switch(type){
				case 'gene-annotations': // gene
					rname = 'Chr' + chrNum;

					$.ajax({
						cache: false,
						type: 'get',
						url: '/genes',
						data: {
							'chr': rname,
							'start': startChrBp,
							'end': endChrBp,
						}
					}).done(function(data) {
						return callback(data);
					});
					break;

				case 'ref-seq-text': // ref
					var startFlank = startChrBp - flankBp,
							endFlank = (endChrBp - startChrBp) + (flankBp * 2);

					if(startFlank < 0) startFlank = 1;
					// if(endFlank > maxChrLen) endFlank = maxChrLen;
					$.ajax({
						cache: false,
						type: 'get',
						url: '/ref/substring',
						data: {
							'chr': rname,
							'start': startFlank,
							'length': endFlank
						}
					}).done(function(data) {
						return callback(data);
					});
					break;

				case 'ref-chr-length': // chr length
					$.ajax({
						cache: false,
						type: 'get',
						url: '/ref/chr/length',
						data: {
							'chr': rname
						}
					}).done(function(data) {
						return callback(data[0]);
					});
					break;

				case 'sv-fetch-table': // sv to be displayed on table on brush
					var once = false;
					$('#chr-coordinates').addClass('loading disabled');
					$('#table-icon-tool').remove();
					$('#save-icon-tool').remove();
					$('#query-table-toggle').addClass('sleep');
					$('#query-table-toggle').append('<div class="ui active inline mini loader" id="save-icon-loading"></div>');
					$('#show-table-toggle').append('<div class="ui active inline mini loader" id="table-icon-loading"></div>');

					$('#sv-checkboxes input:checked').each(function(){
						$.ajax({
							cache: false,
							type: 'get',
							url: '/sv/table',
							data: {
								'chr': rname,
								'type': $(this).attr('id'),
								'start': startChrBp,
								'end': endChrBp,
							},
						}).done(function(data) {
							$('#chr-coordinates').removeClass('loading disabled');
							$('#table-icon-loading').remove();
							$('#save-icon-loading').remove();
							$('#query-table-toggle').removeClass('sleep');
							$('#show-table-toggle').removeClass('sleep');
							if(!once){
								$('#query-table-toggle').append('<i class="save icon" id="save-icon-tool"></i>');
								$('#show-table-toggle').append('<i class="table icon" id="table-icon-tool"></i>');
								once = true;
							}
							return callback(data);
						});
					});
					break;
				
				case 'sv-fetch-view': // sv to be used in the visualization 
					$('#chr-coordinates').addClass('loading disabled');
					$('#sv-loader').removeClass('disabled');

					$('#sv-checkboxes input:checked').each(function(){
						var type = $(this).attr('id');
						$.ajax({
							cache: false,
							type: 'get',
							url: '/sv/view',
							data: {
								'chr': rname,
								'type': type,
								'start': startChrBp,
								'end': endChrBp,
							},
						}).done(function(data) {
							$('#chr-coordinates').removeClass('loading disabled');
							$('#sv-loader').addClass('disabled');
							return callback(data);
						});
					});
					break;
				
				default:
					break;
			}
		}

		// draw the visualization on the SVG [D3] @ readTextFile()
		function renderVisualization(svToDraw, svFrequency){			
			// helpers
			setDetailsOnSubMenu(); // details on top of the visualization when sidebar is closed
			
			// ruler
			drawRuler();

			// reference genome
			drawReferenceGenome();

			var rowInSVG = prepareTypeSpacing(svToDraw),
					variants = Object.keys(svToDraw),
					prevMaxY = 0,
					maxY = 0,
					height = 0,
					base = 50,
					typeCount = 0
			;

			$('#sv-checkboxes input:checked').each(function(){
				typeCount++;
			});

			// structural variants
			for(var i = 0; i < variants.length; i++){
				if(svToDraw[variants[i]].length > 0){
					maxY = drawStructuralVariants(maxY, base, rowInSVG, variants[i], svFrequency);

 					if(maxY == 0){
						base = base + 50; 
 					}
 					else{
 						base = maxY - 10;
 					}

					if(height < maxY){
						height = maxY;
						brushHeight = height + 20;
						$('#sv-visualization').attr('height', (height + 80));
					}
					else{
						brushHeight = maxY + 20;
						$('#sv-visualization').attr('height', (maxY + 50));
						if(maxY == 0){
							brushHeight = 100 * typeCount;
							$('#sv-visualization').attr('height', (brushHeight + 50));
						}
					}

					prevMaxY = maxY;
					maxY = 0;
				}
			}

			drawGeneAnnotations(base);

			addPopups(); // adds the pop-ups for sv track/marker and brush

			addGrid();
		}

		// sets detail on sub menu (appears when sidebar is closed) @ renderVisualization()
		function setDetailsOnSubMenu(){
			startChrBp = Number($('#chr-start').val());
			endChrBp = Number($('#chr-end').val());
			chrNum = Number($('#chr-num-select').val());

			$('#submenu-chr').text(chrNum);
			$('#submenu-start').text(startChrBp + ' bp');
			$('#submenu-end').text(endChrBp + ' bp');
		}

		// draw the ruler at the top [D3] @ renderVisualization()
		function drawRuler(){
			var chrNum = Number($('#chr-num-select option:selected').val()) - 1,
					currentChr = referenceGenome[chrNum],
					interval = 0, chrSequence,
					rightAllowance = 10
			;

			flankBp = Number($('#ruler-flank').val());
			chrLength = bpToPx(endChrBp - startChrBp + 1);
			// chrSequence = setSequenceRange(chrSequence, true);

			retrieveDataFromDB('ref-seq-text', function (data){
				addSequenceText(new String(data).toUpperCase());
			}); 

			// adjusts the svg for it to be scrollable
			$('#sv-visualization').attr('width', chrLength + (svgLeftMargin * 2) + (bpToPx(flankBp) * 2) + 50);

			// draws the horizontal ruler
			svg
				.append('g')
					.attr('class', 'ruler')
				.append('line')
					.attr('x1', 0)
					.attr('x2', chrLength + (svgLeftMargin * 2) + (bpToPx(flankBp) * 2) + rightAllowance)
					.attr('y1', svgTopMargin)
					.attr('y2', svgTopMargin)
					.attr('stroke-width', 2)
					.attr('stroke', 'black');

			addRulerInterval();
		}

			// adds the ruler interval, can be edited by the user [D3] @ drawRuler()
			function addRulerInterval(){
				// adds the vertical line indicator for the ruler interval
				function addVerticalLineIndicator(x1, x2, y1, y2, color){
					svg
						.append('g')
							.attr('class', 'ruler')
						.append('line')
							.attr('x1', x1)
							.attr('x2', x2)
							.attr('y1', y1)
							.attr('y2', y2)
							.attr('stroke-width', 1)
							.attr('stroke', color)
					;
				}

				// adds the interval text at the right side of the vertical line indicator
				function addIntervalText(x, y, color, text){
					svg
						.append('g')
							.attr('class', 'ruler')
						.append('text')
							.attr('x', x)
							.attr('y', y)
							.attr('font-family', 'Courier, "Lucida Console", monospace')
							.attr('font-size', '12px')
							.attr('fill', color)
						.text(text)
						.style('pointer-events', 'none')
					;
				}

				// update current ruler interval
				rulerInterval = Number($('#ruler-interval').val()); 

				startChrBp = Number($('#chr-start').val());
				endChrBp = Number($('#chr-end').val());
				
				var flankPx = bpToPx(flankBp),
						startPx = flankPx + svgLeftMargin + 2,
						endPx = bpToPx(endChrBp - startChrBp) + startPx + 7,
						onePx = 7;
				;

				if(startChrBp != 1){
					endPx = endPx - 7;
					onePx = 0;
				}

				// always add and interval on the start and end of query
				// start interval
				addVerticalLineIndicator(startPx, startPx, (svgTopMargin - 10), svgTopMargin, 'red');
				addIntervalText((2 + startPx), (svgTopMargin - 3), 'red', startChrBp);

				// end interval
				addVerticalLineIndicator(endPx, endPx, (svgTopMargin - 10), svgTopMargin, 'blue');
				addIntervalText((2 + endPx), (svgTopMargin - 3), 'blue', endChrBp);

				var cappedStartBp = startChrBp + (10 - (startChrBp % 10)),
						cappedEndBp = endChrBp + (10 - (endChrBp % 10))
						flagOneDifference = 0
				;

				// adds a ruler interval
				// 1. two before the starting interval: cappedStartBp - (rulerInterval * 2)
				// 2. within the start and the end: cappedStartBp -> cappedEndBp
				// 3. two after the end interval: cappedEndBp + (rulerInterval * 2)
				for(var i = cappedStartBp - (rulerInterval * 2); i < cappedEndBp + (rulerInterval * 2); i = i + rulerInterval) {
					if(i - startChrBp == 1 && flagOneDifference == 0){
						i = i + rulerInterval;
						flagOneDifference = 1;
					}
										
					if(i != startChrBp && i != endChrBp){
						addVerticalLineIndicator((startPx + bpToPx(i - startChrBp) + onePx), (startPx + bpToPx(i - startChrBp) + onePx), (svgTopMargin - 10), svgTopMargin, 'black');
						addIntervalText((2 + startPx + bpToPx(i - startChrBp) + onePx), (svgTopMargin - 3), 'black', i);
					}
				}
			}

			// adds the sequence text, can be toggled [D3] @ drawRuler()
			function addSequenceText(chrSequence){
				var getStart = flankBp,
						getEnd = chrSequence.length - flankBp,
						mainSequence = '',
						leftFlankSequence = '',
						rightFlankSequence = ''
						flankPx = bpToPx(flankBp),
						startPx = flankPx + svgLeftMargin,
						endPx = bpToPx(endChrBp - startChrBp) + startPx
				;

				if(startChrBp < flankBp) getStart = startChrBp
				leftFlankSequence = chrSequence.substring(0, getStart);
				// adds - if the left flank string is not == flankBp
				while(leftFlankSequence.length != flankBp){
					leftFlankSequence = '-' + leftFlankSequence;
				}
				mainSequence = chrSequence.substring(getStart, getEnd);
				rightFlankSequence = chrSequence.substring(getEnd, chrSequence.length);

				// draws the sequence text
				if(showSequence){
				 	 svg
						.append('g')
							.attr('class', 'sequence-text')
						.append('text')
							.attr('x', svgLeftMargin)
							.attr('y', svgTopMargin + 25)
							.attr('font-family', 'Courier, "Lucida Console", monospace')
							.attr('font-size', '12px')
							.attr('fill', '#9E9E9E')
						.text(leftFlankSequence)
						.style('pointer-events', 'none');	

				 	 svg
						.append('g')
							.attr('class', 'sequence-text')
						.append('text')
							.attr('x', svgLeftMargin + flankPx)
							.attr('y', svgTopMargin + 25)
							.attr('font-family', 'Courier, "Lucida Console", monospace')
							.attr('font-size', '12px')
							.attr('fill', 'black')
						.text(mainSequence)
						.style('pointer-events', 'none');	

					svg
						.append('g')
							.attr('class', 'sequence-text')
						.append('text')
							.attr('x', endPx)
							.attr('y', svgTopMargin + 25)
							.attr('font-family', 'Courier, "Lucida Console", monospace')
							.attr('font-size', '12px')
							.attr('fill', '#9E9E9E')
						.text(rightFlankSequence)
						.style('pointer-events', 'none');	
				}
			}

		function addPatterns(){
			// pattern on for deletion, code taken from: http://jsfiddle.net/yduKG/3/
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
		}

		// draws the reference genome line [D3] @drawRuler()
		function drawReferenceGenome(){
			var flankPx = bpToPx(flankBp),
					rightAllowance = bpToPx(10);

			addPatterns();

			// provides the bg color at the bottom of the pattern
			svg
				.append('g')
					.attr('class', 'reference-genome-line')
				.append('rect')
					.attr('x', 0)
					.attr('y', svgTopMargin + 30)
					.attr('width', chrLength + svgLeftMargin + (flankPx * 2) + rightAllowance)
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
					.attr('width', chrLength + svgLeftMargin + (flankPx * 2) + rightAllowance)
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

				$('#popup-element').css({
					'z-index': 1
				});

				$('#sv-label').removeClass('teal', 'blue', 'violet', 'purple');
			}

			// shows the popup on del/inv/dup track click @ drawReferenceGenome()
			function trackClick(){
				var svType = $(this).attr('type'),
						translate = 'translate(' + (event.clientX - 127) + 'px, ' + event.clientY + 'px)',
						color = ''
				;

				switch(svType){
					case 'DEL':
						color = 'teal';
						break;
					case 'INV':
						color = 'blue';
						break;
					case 'DUP':
						color = 'violet';
						break;
					case 'INS':
						color = 'purple';
						break;
					default:
						color = 'magical SV\'s';
						break;
				}

				startChrBp = Number($('#chr-start').val());
				endChrBp = Number($('#chr-end').val());
				chrNum = Number($('#chr-num-select').val());

				$('#popup-element').css({
					'transform': translate,
					'z-index': 10
				});
    
				$('#sv-label').addClass(color);
				$('#sv-label-detail').text(svType);
				$('#sv-label-chr-detail').text(chrNum);
				$('#sv-label-start-detail').text($(this).attr('start') + ' bp');
				$('#sv-label-end-detail').text($(this).attr('end') + ' bp');
				$('#sv-label-cluster-detail').text($(this).attr('clusterid'));
				$('#sv-label-sampleID-detail').text($(this).attr('sampleid'));
			}

			// shows the modal on ins marker click @ drawReference()
			function markerClick(){
				var startIns = Number($(this).attr('start')),
						endIns = Number($(this).attr('end')),
						tag = this
				;

				$(this).addClass('sleep');
				$('.remove-table-modal-ins').remove();

				retrieveDataFromDB('sv-fetch-table', function (data){
					if(data.length != 0){
						var svIns = [], uniqueSvIns = [], noOfRows = 0, noOfClusters = 0, clusterFrequency = {};

						for(var i = 0; i < data.length; i++){
							var svObject = data[i];

							if(svObject['type'] == 'INS'){
								if(svObject['start'] == startIns && svObject['end'] == endIns){
									var createObject = {};
									createObject['sampleid'] = svObject['sampleid'];
									createObject['sequence'] = svObject['sequence'].replace(/,/g, ',<br>');
									clusterFrequency[svObject['clusterid']] = 1 + (clusterFrequency[svObject['clusterid']] || 0);
									svIns.push(createObject);
								}
							}
						}

						svIns.unshift({
							'sampleid': 'Sample ID',
							'sequence': 'Sequence',
						});

						$('.sequence-delete').remove();
						$('#sv-ins-details').modal('show');

						var svType = $(this).attr('type'),
								translate = 'translate(' + (event.clientX - 127) + 'px, ' + event.clientY + 'px)',
								color = 'purple'
						;

						startChrBp = Number($('#chr-start').val());
						endChrBp = Number($('#chr-end').val());
						chrNum = Number($('#chr-num-select').val());
						noOfRows = svIns.length;
						noOfClusters = (Object.keys(clusterFrequency)).length;

						$('#sv-modal').addClass(color);
						$('#sv-modal-detail').text('INS');
						$('#sv-modal-chr-detail').text(chrNum);
						$('#sv-modal-start-detail').text(startIns + ' bp');
						$('#sv-modal-end-detail').text(endIns + ' bp');
						$('#return-row').text(noOfRows);
						$('#return-cluster').text(noOfClusters);

						$.jsontotable(svIns, { id: '#sv-modal-table-ins', header: true, className: 'ui selectable celled padded table remove-table-modal-ins' });
						$(tag).removeClass('sleep');
					}
				});	
			}

		// determine the number of branches to be visualized; works for del, dup, inv
		function assignHotspotNumber(type, svToDraw){
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
			var minBound = svToDraw[type][0]['start'],
					maxBound = svToDraw[type][0]['end'],
					svBranchHeight = 0,
					hotspotCount = 0
			;

			svToDraw[type][0]['hotspot'] = hotspotCount;
			svToDraw[type][0]['hotspotIndex'] = 0;
			hotspotFrequency[type][hotspotCount] = 1 + (hotspotFrequency[type][hotspotCount] || 0);
			svBranchHeight = hotspotFrequency[type][hotspotCount];

			for(var i = 1; i < svToDraw[type].length; i++){
				var nextSV = svToDraw[type][i];

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
			}

			return svBranchHeight;
		}

		// computes the spacing for each sv-type to be visualized on the 
		function prepareTypeSpacing(svToDraw){
			var svType = [],
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
				if(svToDraw[svType[i]].length > 0){
					assignHotspotNumber(svType[i], svToDraw);
				}
			}

			if(svToDraw['INS'].length != 0){
				noOfmaxBranches = assignHotspotNumber('INS', svToDraw);
			}
			rowsSVG = (noOfmaxBranches % 2) != 0 ? noOfmaxBranches - 1 : noOfmaxBranches;
			adjustedRowsSVG = (trackHeight) * rowsSVG;

			return adjustedRowsSVG;
		}

		// draws the sv's within the specified range @ renderVisualization()
		function drawStructuralVariants(maxY, int, rowsSVG, svType, svFrequency){
			// int = (int > 200) ? ((int > 300) ? int - 30 : int - 15) : int;

			var svClusters = Object.keys(svFrequency[svType]).length,
					refToSVSpace = int, // in px
					fillColor = $('.pusher').css('backgroundColor'),
					flankPx = bpToPx(flankBp),
					rightAllowance = bpToPx(10),
					strokeColor = '', strokeWidth = 0
			;

			if(svType != 'INS'){
				var hotspotKeys = Object.keys(hotspotFrequency[svType]),
						maxBranch = 0,
						baseY = 0;

				for(var j = 0; j < hotspotKeys.length; j++){
					if( maxBranch < hotspotFrequency[svType][hotspotKeys[j]] ){
						maxBranch = hotspotFrequency[svType][hotspotKeys[j]];
					}
				}

				if(maxBranch >= 3){
					maxBranch = Math.ceil(maxBranch / 2);
				}
				maxBranch--;
				baseY = svgTopMargin + refToSVSpace + (maxBranch * (trackHeight + 5));

				// draws the merged and continuous sv line
				svg
					.append('g')
						.attr('class', 'sv-merged-line')
					.append('rect')
						.attr('x', 0)
						.attr('y', baseY)
						.attr('width', chrLength + svgLeftMargin + (flankPx * 2) + rightAllowance)
						.attr('height', trackHeight)
						.attr('class', 'sample-genome')
						.attr('color', '#ab1a25')
					.style('fill', '#ab1a25');

				// determines the x position of the track/sv
				function locateXCoordinate(start){
					var offset = svgLeftMargin + bpToPx(flankBp),
							x = 0
					;
					
					startChrBp = Number($('#chr-start').val());
					
					x = (startChrBp == 1) ? (offset + bpToPx(start)) : (offset + bpToPx(start - startChrBp));
					return x;
				}

				// determines the y position of the track/sv
				function locateYCoordinate(d){
					var index = d['hotspotIndex'],
							maxCount = hotspotFrequency[d['type']][d['hotspot']], // number of branches 
							count = 0,
							y = 0,
							trackIntervalHeight = 5
					;

					if(maxCount == 1){
						// for single-itemed hotspot
						return baseY;
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
					y = svgTopMargin + refToSVSpace + (Math.abs(count) * ((trackHeight) + trackIntervalHeight));
					maxY = (y > maxY) ? y : maxY;

					return y;
				}

				// forms the vertices of the DEL/DUP/INV track (rectangle on branch) @ svg.polyline.sv-branch
				function formVertices(d){	
					startChrBp = Number($('#chr-start').val());

					var string = '',
							yFactor = 2.5,
							base = baseY + yFactor,
							y = locateYCoordinate(d) + yFactor,
							offset = bpToPx(flankBp) - 50,
							xStart = (startChrBp == 1) ? (offset + bpToPx(d['start'])) : (offset + bpToPx(d['start'] - startChrBp));
							xEnd = xStart + bpToPx((d['end'] - d['start'])) + offset,
							offset = 10 + ((d['hotspotIndex'] - 1) * 9)
					;

					// makes the branching angle of each branches equal no matter the y position
					if(d['hotspotIndex'] > (hotspotFrequency[d['type']][d['hotspot']] / 2)){
						var indexFix = (d['hotspotIndex'] + 1) - Math.ceil(hotspotFrequency[d['type']][d['hotspot']] / 2);
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
				;

				function drawArrowhead(direction){
					var adjustment = 0;

					switch(direction){
						case 'up':
							adjustment = -4;
							break;
						case 'down':
							adjustment = 8;
							break;
					}

					svg
						.selectAll('sv-inv-arrowhead')		
						.data(svToDraw[svType])
							.enter()
						.append('line')
							.attr('x1', function(d){ return locateXCoordinate(d['start']) } )
							.attr('x2', function(d){ return locateXCoordinate(d['start']) + 8 } )
							.attr('y1', function(d){ return locateYCoordinate(d) + 2 } )
							.attr('y2', function(d){ return locateYCoordinate(d) + adjustment } )
							.attr('color', fillColor)
							.attr('start', function(d) { return d['start'] })
							.attr('end', function(d) { return d['end'] })
							.attr('type', function(d) { return d['type'] })
							.attr('clusterid', function(d) { return d['clusterid'] })
							.attr('class', 'sv-inv-arrowhead')
						.style('fill', 'none')
						.style('stroke', fillColor)
						.style('stroke-width', 2)
					;
				}

				// changes color of track color when svtype = dup | inv
				switch(svType){
					case 'DUP':
						fillColor = '#480b0f';
						strokeColor = 'none';
						strokeWidth = 0;
						break;
					case 'INV':
						fillColor = '#480b0f';
						strokeColor = 'none';
						strokeWidth = 0;
						drawArrowhead('up');
						drawArrowhead('down');
						break;
					case 'DEL':
						strokeColor = '#ab1a25';
						strokeWidth = 0.5;
						break;
				}

				// highlight the range of the given sv 
				svg
					.selectAll('sv-sample')		
					.data(svToDraw[svType])
						.enter()
					.append('rect')
						.attr('x', function(d){ return locateXCoordinate(d['start']) } )
						.attr('y', function(d){ return locateYCoordinate(d)} )
						.attr('width', function(d) { return bpToPx((d['end'] - d['start'])) } )
						.attr('height', trackHeight)
						.attr('stroke', strokeColor)
						.attr('stroke-width', strokeWidth)
						.attr('color', fillColor)
						.attr('start', function(d) { return d['start'] })
						.attr('end', function(d) { return d['end'] })
						.attr('type', function(d) { return d['type'] })
						.attr('clusterid', function(d) { return d['clusterid'] })
					.style('fill', fillColor)
					.on('mouseover', trackMouseOver)
					.on('mouseout', trackMouseOut)
					.on('click', trackClick)
				;
			}
			else{
				// draws the merged and continuous sv line
				svg
					.append('g')
						.attr('class', 'sv-merged-line')
					.append('rect')
						.attr('x', 0)
						.attr('y', svgTopMargin + refToSVSpace + rowsSVG)
						.attr('width', chrLength + svgLeftMargin + (flankPx * 2) + rightAllowance)
						.attr('height', trackHeight)
						.attr('class', 'sample-genome')
						.attr('color', '#ab1a25')
					.style('fill', '#ab1a25');

				// forms the vertices of the INS marker (pentagon pointing downwards) @ svg.polgon.sv-stack
				function formVertices(d){		
					var string = '',
							base = svgTopMargin + refToSVSpace + rowsSVG - 10,
							y = base - (d['hotspotIndex'] * 10),
							markerHeight = y + 5,
							xStart = (bpToPx(d['start'] - startChrBp) + bpToPx(flankBp) + svgLeftMargin),
							xEnd = (bpToPx(d['end'] - startChrBp) + bpToPx(flankBp) + svgLeftMargin)
						;

						string = xStart + ',' + markerHeight + ' ';
						string = string + xStart + ',' + y + ' ';
						string = string + xEnd + ',' + y + ' ';
						string = string + xEnd + ',' + markerHeight + ' ';
						string = string + ((xStart + xEnd) / 2) + ',' + (markerHeight + 5) + ' ';
						return string;
				}

				svg
					.selectAll('sv-stack')		
					.data(svToDraw[svType])
						.enter()
					.append('polygon')
						.attr('points', function(d){ return formVertices(d) } )
						.attr('start', function(d) { return d['start'] })
						.attr('end', function(d) { return d['end'] })
						.attr('clusterid', function(d) { return d['clusterid'] })
						.attr('type', function(d) { return d['type'] })
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
						.attr('clusterid', function(d) { return d['clusterid'] })
						.attr('type', function(d) { return d['type'] })
						.attr('color', '#ab1a25')
					.style('fill', '#ab1a25')
					.on('mouseover', trackMouseOver)
					.on('mouseout', trackMouseOut)
					.on('click', markerClick)
				;	

				maxY = 0;
			}

			return maxY;
		}

		// makes the fill of the track turn into a diagonal hatch [D3] @ drawReferenceGenome()
		function refMouseOver(){
			d3.select(this).style('stroke', 'url(#diagonalHatch)');
			$('.sample-genome').css('fill', 'url(#diagonalHatch)');
		}

		// returns the previous color of the highlighted track [D3] @ drawReferenceGenome()
		function refMouseOut(){
			var color = d3.select(this).attr('color');
			d3.select(this).style('stroke', color);
			color = $('.sample-genome').attr('color');
			$('.sample-genome').css('fill', color);
		}

		function drawGeneAnnotations(refToSVSpace){
			function locateXCoordinate(start){
				var offset = svgLeftMargin + bpToPx(flankBp),
						x = 0
				;
				
				startChrBp = Number($('#chr-start').val());
				
				x = (startChrBp == 1) ? (offset + bpToPx(start)) : (offset + bpToPx(start - startChrBp));
				return x;
			}

			// determines the y position of the track/sv
			function locateYCoordinate(d){
				return y = svgTopMargin + refToSVSpace + 20;
			}

			function getAttribute(d){
				var content = d['attributes'].split(';')
						id = content[0].replace('ID=', '')
				;

				svg
					.append('g')
						.attr('class', 'gene-id')
					.append('text')
						.attr('x', function(){ return locateXCoordinate(d['start']) })
						.attr('y', function(){ return locateYCoordinate(d) - 10 })
						.attr('font-family', 'Courier, "Lucida Console", monospace')
						.attr('font-size', '12px')
						.attr('fill', 'black')
					.text(id)
					.style('pointer-events', 'none')
				;

				return id;
			}

			retrieveDataFromDB('gene-annotations', function (data){
				svg
					.selectAll('gene-annotations')		
					.data(data)
						.enter()
					.append('rect')
						.attr('x', function(d){ return locateXCoordinate(d['start']) })
						.attr('y', function(d){ return locateYCoordinate(d) })
						.attr('width', function(d) { return bpToPx((d['end'] - d['start'])) } )
						.attr('height', trackHeight)
						.attr('color', '#212121')
						.attr('start', function(d) { return d['start'] })
						.attr('end', function(d) { return d['end'] })
						.attr('id', function(d) { return getAttribute(d) })
					.style('fill', '#212121')
					.on('mouseover', trackMouseOver)
					.on('mouseout', trackMouseOut)
					.on('click', trackClick)
				;

				initializePanAndZoom();
			})
		}

		// add popup on track click [D3 + jQuery] @ renderVisualization()
		function addPopups(){
			var popupSVClick =
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
					'</div>',
				popupStartBrush =
					'<div class="ui basic label" id="brush-width-start">' + 
						'<div class="ui list">' + 
							'<div class="item">' + 
							'<div class="ui image large label remove-padding" id="brush-label-start">' + 
							'</div>' + 
							'</div>' + 
						'</div>' + 
					'</div>',
				popupEndBrush =
					'<div class="ui basic label">' + 
						'<div class="ui list">' + 
							'<div class="item">' + 
							'<div class="ui image large label remove-padding" id="brush-label-end">' + 
							'</div>' + 
							'</div>' + 
						'</div>' + 
					'</div>',
				popupLengthBrush =
					'<div class="ui basic label">' + 
						'<div class="ui list">' + 
							'<div class="item">' + 
							'<div class="ui image large label remove-padding" id="brush-label-length">' + 
							'</div>' + 
							'</div>' + 
						'</div>' + 
					'</div>'
			;

			svg
				.append('foreignObject')
					.attr('id', 'brush-popup-start')
					.attr('x', -1000)
					.attr('y', -1000)
					.attr('height', 10)
					.attr('width', 150)
			;

			svg
				.append('foreignObject')
					.attr('id', 'brush-popup-end')
					.attr('x', -1000)
					.attr('y', -1000)
					.attr('height', 10)
					.attr('width', 150)
			;

			svg
				.append('foreignObject')
					.attr('id', 'brush-popup-length')
					.attr('x', -1000)
					.attr('y', -1000)
					.attr('height', 10)
					.attr('width', 150)
			;

			// $('body').html(popupSVClick);
			$('#brush-popup-start').html(popupStartBrush);
			$('#brush-popup-end').html(popupEndBrush);
			$('#brush-popup-length').html(popupLengthBrush);
		}

		function addGrid(){
			if(showGrid){
				var baseCol = svgLeftMargin + bpToPx(flankBp),
						boundaryCol = chrLength + (svgLeftMargin * 2) + (bpToPx(flankBp) * 2) + 50,
						baseRow = svgTopMargin,
						boundaryRow = brushHeight,
						columns = [],
						rows = []
				;

				for(var i = baseCol; i < boundaryCol; i = i + 7){
					svg
						.append('g')
							.attr('class', 'grid-col')
						.append('line')
							.attr('x1', i)
							.attr('x2', i)
							.attr('y1', svgTopMargin)
							.attr('y2', brushHeight)
							.attr('stroke-width', 0.5)
							.attr('stroke-opacity', 0.3)
							.attr('stroke', '#9E9E9E');
				}

				for(var i = baseRow; i < boundaryRow; i = i + 7){
					svg
						.append('g')
							.attr('class', 'grid-col')
						.append('line')
							.attr('x1', baseCol)
							.attr('x2', boundaryCol)
							.attr('y1', i)
							.attr('y2', i)
							.attr('stroke-width', 0.5)
							.attr('stroke-opacity', 0.3)
							.attr('stroke', '#9E9E9E');
				}
			}
		}

		// removes the brush @ setupVisualizationTools()
		function removeBrush(absoluteRemove){
			$('#brush-popup-start').attr('x', '-1000px');
			$('#brush-popup-start').attr('y', '-1000px');

			$('#brush-popup-end').attr('x', '-1000px');
			$('#brush-popup-end').attr('y', '-1000px');

			$('#brush-popup-length').attr('x', '-1000px');
			$('#brush-popup-length').attr('y', '-1000px');

			if(absoluteRemove){
				svg.selectAll('.brush').remove(); // clear brush	
			}
		}

		function brushed(){	
			var flankPx = bpToPx(flankBp),
					startPx = flankPx + svgLeftMargin,
					endPx = bpToPx(endChrBp - startChrBp) + startPx + 7,
					x, y = brushHeight - 40, lengthBrush,
					xAdjust = Math.ceil(Number($('#brush-width-start').width())) + 30
			;

			startChrBp = Number($('#chr-start').val());
			endChrBp = Number($('#chr-end').val());

			startBrushPx = Number($('.handle--w').attr('x')) + 3;
			endBrushPx = Number($('.handle--e').attr('x')) + 3;

			startBrushBp = Math.floor(pxToBp(startBrushPx) - flankBp - pxToBp(svgLeftMargin)) + 1;
			endBrushBp = Math.floor(pxToBp(endBrushPx) - flankBp - pxToBp(svgLeftMargin));
			if(startBrushPx == (startPx)) startBrushBp = 1;
			if((endBrushPx - 7) == (endPx)) endBrushBp = (endChrBp - startChrBp + 1);
			lengthBrush = (endBrushBp - startBrushBp) + 2;

			if(startChrBp != 1){
				startBrushBp = startBrushBp + startChrBp - 1;
				endBrushBp = startChrBp + endBrushBp;
				if(endBrushBp == (endChrBp + 1)) endBrushBp = endChrBp;
				lengthBrush = (endBrushBp - startBrushBp) + 1;
			}

			x = startBrushPx - xAdjust;
			$('#brush-popup-start').attr('x', x);
			$('#brush-popup-start').attr('y', y);
			$('#brush-label-start').text(startBrushBp);

			x = endBrushPx + 7;
			$('#brush-popup-end').attr('x', x);
			$('#brush-popup-end').attr('y', y);
			$('#brush-label-end').text(endBrushBp);

			x = ((endBrushPx + startBrushPx) / 2) - 20;
			y = brushHeight + 10;
			$('#brush-popup-length').attr('x', x);
			$('#brush-popup-length').attr('y', y);
			$('#brush-label-length').text(lengthBrush);
		}

		// draws a brush on top of the sv visualization @ setupVisualizationTools()
		function drawBrush(){
			startChrBp = Number($('#chr-start').val());
			endChrBp = Number($('#chr-end').val());

			var flankPx = bpToPx(flankBp),
					startPx = flankPx + svgLeftMargin,
					endPx = bpToPx(endChrBp - startChrBp) + startPx + 14
			;

			if(startChrBp != 1) endPx = endPx - 7;

			brush = d3
				.brushX()
					.extent([[startPx, 30], [endPx, brushHeight]])
			 	.on('brush', brushed)
			;

			svg
				.append('g')
				.attr('class', 'x brush')
				.call(brush)
			;

			$('.overlay').on('click', function(){
				removeBrush(false);
			});
		}

		// initialize pan and zoom for the whole SVG [jQuery plugin] @ renderVisualization()
		function initializePanAndZoom(){
			if(!panZoomSVG == null)	panZoomSVG.destroy();
			var zoomFactor = 1;

			panZoomSVG = svgPanZoom('#sv-visualization', {
				panEnabled: false,
				zoomEnabled: false,
				dblClickZoomEnabled: false,
				mouseWheelZoomEnabled: false,
				preventMouseEventsDefault: true,
				zoomScaleSensitivity: 0.1,
				minZoom: 0.1,
				maxZoom: 5,
				fit: false,
				contain: false,
				center: false
			});


			// assign tools on zoom tool
			$('#reset-toggle').on('click', function(){
				panZoomSVG.reset();
			});

			$('#fit-toggle').on('click', function(){
				panZoomSVG.fit();
			});

			$('#zoom-in-toggle').on('click', function(){
				panZoomSVG.zoomAtPointBy(zoomFactor + 0.1, {'x': 0, 'y': 0});
			});

			$('#zoom-out-toggle').on('click', function(){
				panZoomSVG.zoomAtPointBy(zoomFactor - 0.1, {'x': 0, 'y': 0});
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
				if(isRealData){
					retrieveDataFromDB('ref-chr-length', function (data){
						$('#max-count').text(data);
					});
				}
				else{
					var no = Number($('#chr-num-select').val());
					switch(no){
						case 1: $('#max-count').text('1080'); break;
						case 2: $('#max-count').text('943'); break;
						case 3: $('#max-count').text('600'); break;
					}
				}
			});

			// sets the max and min even the user specifies out of boundaries
			$('#ruler-interval').on('focusout', function(){
				var interval = Number($('#ruler-interval').val());
				if(interval < minInterval){
					$('#ruler-interval').val(minInterval);
				}
				else if(interval > maxInterval){
					$('#ruler-interval').val(maxInterval);
				}
			});

			$('#ruler-flank').on('focusout', function(){
				var flankPx = Number($('#ruler-flank').val());
				if(flankPx < minFlank){
					$('#ruler-flank').val(minFlank);
				}
				else if(flankPx > maxFlank){
					$('#ruler-flank').val(maxFlank);
				}
			});

			$('#chr-start').on('focusout', function(){
				startChrBp = Number($('#chr-start').val());

				if(startChrBp < 1) $('#chr-start').val(1);
			});

			$('#chr-end').on('focusout', function(){
				retrieveDataFromDB('ref-chr-length', function (data){
					var endChrBp = Number($('#chr-end').val()),
							maxBound = data;

					if(!isRealData){
						var no = Number($('#chr-num-select').val());
						switch(no){
							case 1: maxBound = Number($('#max-count').text('1080')); break;
							case 2: maxBound = Number($('#max-count').text('943')); break;
							case 3: maxBound = Number($('#max-count').text('600')); break;
						}
					}

					if(endChrBp > maxBound) $('#chr-end').val(maxBound);
				});
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

			// toggles the sequence text
			$('#toggle-grid').on('change', function(){
				if($('#toggle-grid').is(':checked') === false){
					showGrid = false;
				}
				else{
					showGrid = true;	
				}
			});

			$('#left-sidebar-toggle').on('click', function(){
				isSidebarOpen = !isSidebarOpen;
				if(isSidebarOpen){
					$('#svg-holder').css('width', '95%');	// TODO: responsive width

					if(brushToggle){
						changeToolState('#brush-icon', 'brush', 'check', '#brush-toggle');
						removeBrush(true);
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
					$('#svg-visualization-area').css('width', '100%'); 
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
			chrNum = Number($('#chr-num-select').val());

			$('#chr-coordinates').click(function(){
				svg.selectAll('*').remove(); // clear svg	

				$('#sv-visualization').attr('width', '100%');
				$('#sv-visualization').attr('height', '0');

				$('#show-table-toggle').addClass('sleep');
				$('#table-icon-tool').removeClass('table').addClass('close');

				retrieveDataFromDB('ref-chr-length', function (data){
					var maxBound = data,
							errorRange = false, errorSV = false,
							svType = []
					;
			
					if(!isRealData){
						var no = Number($('#chr-num-select').val());
						switch(no){
							case 1: maxBound = Number($('#max-count').text('1080')); break;
							case 2: maxBound = Number($('#max-count').text('943')); break;
							case 3: maxBound = Number($('#max-count').text('600')); break;
						}
					}

					startChrBp = Number($('#chr-start').val());
					endChrBp = Number($('#chr-end').val());

					$('#sv-checkboxes input:checked').each(function(){
						// gets all the checked checkboxes
						svType.push($(this).attr('id'));
					});
					
					// bounds
					if(maxBound < endChrBp){
						// checks if the upper bound exceeds the length of the current chromosome
						$('#range-message').text('The end range exceeds the length of the chromosome.');
						errorRange = true;
					}
					if(startChrBp > endChrBp){
						// checks if the lower bound is greater than the lower bound
						$('#range-message').text('Start range is larger than end range.');
						errorRange = true;
					}
					if((endChrBp - startChrBp) < minimumRange){
						// checks if the ranges is greater than the set minimum range
						$('#range-message').text('Check the range. The minimum range is ' + minimumRange + '.');
						errorRange = true;
					}

					if(startChrBp == -1){
						// checks if the start range input fields are empty
						$('#range-message').text('Start range has no value.');
						errorRange = true;
					}
					else if(endChrBp == -1){
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

						filterSV();
					}
				});
			});	
		}

			// draws the structural variants inside the queried start and end @ initializeSetCoordinates()
			function noSVFound(typePool){
				var typeString = '';
				if(!typePool.includes('DEL')){
					typeString = typeString + 'deletions' + ', ';
				}
				if(!typePool.includes('INV')){
					typeString = typeString + 'inversions' + ', ';
				}
				if(!typePool.includes('DUP')){
					typeString = typeString + 'duplications' + ', ';
				}
				if(!typePool.includes('INS')){
					typeString = typeString + 'insertions' + ', ';
				}

				// sets the message for the error, automatically closes after 10 seconds
				$('#query-header').text('There are no ' + typeString + ' found from ' + startChrBp + 'bp - ' + endChrBp + 'bp at chromosome number ' + chrNum + '.');
				$('#dismissible-error-query').removeClass('hidden').transition('pulse');
				$('#dismissible-error-query').delay(10000).fadeOut(400);
			}

				// collects all the sv's inside the range quried by user @ noSVFound()
				function filterSV(){
					svFrequency = {'INS':{}, 'DEL':{}, 'INV':{}, 'DUP':{}};
					svToDraw = {'INS':[], 'DEL':[], 'INV':[], 'DUP':[]};
					
					var svType = [],
							svArray = [],
							returnArray = [],
							once = false,
							typeCount = 0
					;

					startChrBp = Number($('#chr-start').val());
					endChrBp = Number($('#chr-end').val());
					chrNum = Number($('#chr-num-select option:selected').val());

					$('#sv-checkboxes input:checked').each(function(){
						// gets all the checked checkboxes
						svType.push($(this).attr('id'));
						typeCount++;
					});

					retrieveDataFromDB('sv-fetch-view', function (data){
						var typePool = [],
								svType = []
						;

						if(data.length != 0){
							for(var i = 0; i < data.length; i++){
								var svObject = data[i],
										type = svObject['type'],
										cluster = Number(svObject['clusterid']);
								
								if(typePool.includes(type) == false){
									typePool[typePool.length] = type;
								}
								
								svToDraw[svObject['type']].push(svObject);
								svFrequency[type][cluster] = 1 + (svFrequency[type][cluster] || 0);
							}


							if(typePool.length < typeCount){
								noSVFound(typePool);
							}
							else{
								renderVisualization(svToDraw, svFrequency);
							}

							once = true;
						}
						else{
							if(!once) noSVFound(typePool);
							once = true;
						}
					}); 
				}

		// returns the sv-related info, index == 0, color; index == 1, type
		function svToText(index){
			var svType = [],
					svString = '',
					names = [
						['teal', 'blue', 'violet', 'purple'],
						['deletions', 'inversions', 'duplications', 'insertions'],
					]
			;

			if(index == 1){
				$('#sv-checkboxes input:checked').each(function(){
					// gets all the checked checkboxes
					svType.push($(this).attr('id'));
				});
			}

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
						break;
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

			// set the initial ruler flankPx to 20
			$('#ruler-flank').attr('value', '30');
			$('#ruler-flank').attr('min', minFlank);
			$('#ruler-flank').attr('max', maxFlank);
			$('#ruler-flank').attr('step', '10');

			// set the attributes of the svg
			$('#sv-visualization').attr('height', '0px');
			$('#sv-visualization').attr('width', '0px');

			$('#query-details').css({'-webkit-transform':'translate(-800px, 0px)'});
			$('#zoom-tools').css({'-webkit-transform':'translate(-800px, 0px)'});
			$('#brush-tools').css({'-webkit-transform':'translate(-800px, 0px)'});

    	$('#file-ref').text(fileRef);
    	$('#file-sv-ins').text(fileSVIns);
    	$('#file-sv-del').text(fileSVDel);
    	$('#file-sv-dup').text(fileSVDup);
    	$('#file-sv-inv').text(fileSVInv);
    	$('#file-gene').text(fileGene);
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
		function setupVisualizationTools(){			
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
						removeBrush(true);
						brushToggle = false;

						// shows the brush tools
						$('#brush-tools').css({
							'-webkit-transform':'translate(-800px, 0px)',
							'transition':'transform 0.5s ease'
						});
					}

					// shows the zoom tools
					$('#zoom-tools').css({
						'-webkit-transform':'translate(574px, 0px)',
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
						removeBrush(true);
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
					removeBrush(true);
					
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
						'-webkit-transform':'translate(742px, 0px)',
						'transition':'transform 0.5s ease'
					});

					panZoomSVG.reset(); // resets the view
					drawBrush(rowInSVG);
				}
				brushToggle = !brushToggle;
			});

			$('#query-table-toggle').on('click', function(){
				retrieveDataFromDB('sv-fetch-table', function (data){
					if(data.length != 0){
						svToTable = {'INS':[], 'DEL':[], 'INV':[], 'DUP':[]};

						for(var i = 0; i < data.length; i++){
							var svObject = data[i],
									type = svObject['type'],
									cluster = Number(svObject['clusterid']);

							svObject['length'] = svObject['end'] - svObject['start'];
							svToTable[svObject['type']].push(svObject);
						}
					}
				});
			});
				
			$('#show-table-toggle').on('click', function(){
				if(!($('rect.selection').attr('width') === undefined)){
					$('#sv-modal-table').modal('show');

					$('.remove-table').remove();
					$('.remove-actions').remove();

					var keys = Object.keys(svToTable),
							arrayOfObjects = []
					;

					copySV = JSON.parse(JSON.stringify(svToTable));

					for(var i = 0; i < keys.length; i++){
						arrayOfObjects = copySV[keys[i]];

						for(var j = 0; j < arrayOfObjects.length; j++){
							if(arrayOfObjects[j]['type'] == 'INS'){
								delete arrayOfObjects[j]['sequence']; 
							}
						}
						
						if(arrayOfObjects.length > 0){
							// adds header for each table
							arrayOfObjects.unshift({
								'chr': 'Chr. No.',
								'start': 'Start',
								'end': 'End',
								'type': 'Type',
								'sampleid': 'Sample ID',
								'clusterid': 'Cluster ID',
								'length': 'Length',
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
							
							$.jsontotable(copySV[keys[i]], { id: '#sv-modal-table', header: true, className: 'ui selectable celled padded table remove-table ' + keys[i] });
						}
					}
					initializeTableExportButtons();
				}
			});

			$('#brush-adjust').on('click', function(){
				retrieveDataFromDB('ref-chr-length', function (data){
					var brushStart = Number($('#brush-start').val()),
							brushEnd = Number($('#brush-end').val()),
							startChrBp = Number($('#chr-start').val()),
							endChrBp = Number($('#chr-end').val()),
							maxBound = data,
							errorRange,
							flankPx = bpToPx(flankBp),
							startPx, endPx, evalStartPx
					;

					if(maxBound < brushEnd){
						// checks if the upper bound exceeds the length of the current chromosome
						$('#brush-range-message').text('The end range exceeds the length of the chromosome.');
						errorRange = true;
					}
					if(brushStart > brushEnd){
						// checks if the lower bound is greater than the lower bound
						$('#brush-range-message').text('Start range is larger than end range.');
						errorRange = true;
					}
					if(brushStart == brushEnd || !(brushStart >= startChrBp || brushEnd <= endChrBp)){
						$('#brush-range-message').text('Invalid range.');
						errorRange = true;
					}
					if(brushStart < startChrBp){
						$('#brush-range-message').text('Invalid start range.');
						errorRange = true;
					}
					if(brushEnd > endChrBp){
						$('#brush-range-message').text('Invalid end range.');
						errorRange = true;
					}

					if(brushStart == 0){
						// checks if the start range input fields are empty
						$('#brush-range-message').text('Start range has no value.');
						errorRange = true;
					}
					else if(brushEnd == 0){
						// checks if the end range input fields are empty
						$('#brush-range-message').text('End range has no value.');
						errorRange = true;
					}

					if(errorRange){
						$('#dismissible-brush').removeClass('hidden').transition('pulse');
					}
					else{
						$('#dismissible-brush').addClass('hidden');

						evalStartPx = startChrBp - brushStart;
						startPx = flankPx + svgLeftMargin + bpToPx(Math.abs(evalStartPx));
						endPx = bpToPx(brushEnd - brushStart) + startPx + 7;
						brushed();

						svg.select('.brush').call(brush.move, [startPx, endPx]);
						$('#brush-label-end').text(Number($('#brush-end').val()));
					}
				});
			});

			// set-up the export button
			$('#screenshot').on('click', function(){
				var width = Number($('#sv-visualization').attr('width')),
						height = Number($('#sv-visualization').attr('height'))
				;

				if(width > 1280){
					$('#sv-visualization').attr('width', '1280px');
				}
				if(height > 800){
					$('#sv-visualization').attr('height', '800px');
				}

				saveSvgAsPng(document.getElementById('sv-visualization'), 'sv-visualization.png', {backgroundColor: 'white'});

				$('#sv-visualization').attr('width', width);
				$('#sv-visualization').attr('height', height);
			});

			// initialize message close
			$('.message .close').on('click', function(){
				$(this).parent().transition('fade');
			}); 

			// automation
			// var s = 1;
			// var e = 100;
			// var s = 20;
			// var e = 75;
			// var s = 1000;
			// var e = 11000;
			// $('#chr-start').val(s);
			// $('#chr-end').val(e);
			// $('#brush-start').val(s);
			// $('#brush-end').val(e);
			// $('#INS').prop('checked', true); 
			// $('#INV').prop('checked', true); 
			// $('#DUP').prop('checked', true); 
			// $('#DEL').prop('checked', true); 
		}

		function initializeTableExportButtons(){
			function formStringSaveFile(tag, separator, fileType){
				var type = tag.id.replace(fileType, ''),
						keys = Object.keys(svToTable),
						arrayOfObjects = copySV[type],
						fields, array = []
				;

				arrayOfObjects.shift();
				if(fileType == 'bed'){
					for(var j = 0; j < arrayOfObjects.length; j++){
						delete arrayOfObjects[j]['sampleid']; 
						delete arrayOfObjects[j]['length']; 
						delete arrayOfObjects[j]['type']; 
					}
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

			$('.export-bed').on('click', function(){
				formStringSaveFile(this, '\t', 'bed');
			});
		}

		// start the visualization
		initialize();		
