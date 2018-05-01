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
