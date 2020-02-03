const http = require('http');
const https = require('https');
const fs = require('fs');


// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  // const replaceText = (selector, text) => {
  //   const element = document.getElementById(selector)
  //   if (element) element.innerText = text
  // }

  // for (const type of ['chrome', 'node', 'electron']) {
  //   replaceText(`${type}-version`, process.versions[type])
  // }
  // alert(process.cwd())
  $.get('./backgrounds/index', function(data) {
  	window.backgrounds = data.split('\n')
  })
  
})

window.downloadBackground = function(url) {

	let protocol = http
	if (url.substring(0, 5) == 'https') {
		protocol = https
	}
	const file = fs.createWriteStream('backgrounds/' + url.substring(url.lastIndexOf('/')+1));
	const request = protocol.get(url, function(response) {
	  response.pipe(file);
	});
}

window.availableBackgrounds = function () {
	return window.backgrounds? window.backgrounds : []
}
window.ipc = require('electron').ipcRenderer;

