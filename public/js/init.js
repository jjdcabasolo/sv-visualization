// initialize semantic ui elements

// initialize and enable semantic sidebar
$('.ui.left.sidebar').sidebar({
	dimPage: false,
	transition: 'push',
	exclusive: true,
	closable: false
});
$('.ui.left.sidebar').sidebar('attach events', '#left-sidebar-toggle');

$('.menu .item').tab(); // enable semantic tab

$('.ui.dropdown').dropdown(); // enable semantic dropdown

$('.ui.checkbox').checkbox(); // enable semantic checkbox

$('#brush-options-toggle').popup({
	on: 'click'
});

$('#interval-range').range({
	min: 10,
	max: 100,
	start: 10,
	step: 10,
	input: '#ruler-interval'
});

$('#flank-range').range({
	min: 20,
	max: 50,
	start: 20,
	step: 10,
	input: '#ruler-flank'
});