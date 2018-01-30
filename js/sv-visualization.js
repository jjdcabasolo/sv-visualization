
// global constants
const fileDirectory = "../data/IRGSP-1.0_genome.fa";

// 

function initialize() {
	readTextFile();
}

// local file reading taken from https://stackoverflow.com/a/14446538
function readTextFile(file) {
	var rawFile = new XMLHttpRequest();
	rawFile.open("GET", file, false);
	rawFile.onreadystatechange = function ()
	{
		if(rawFile.readyState === 4)
		{
			if(rawFile.status === 200 || rawFile.status == 0)
			{
				var allText = rawFile.responseText;
				alert(allText);
			}
		}
	}
	rawFile.send(null);
}