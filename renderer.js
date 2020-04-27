// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.
let app = {
	timeEl: null,
	dateEl: null,
	dateInterval: null,
	internetIconEl: null,
	internetInterval: null,
	calendars: [],
	calendarEvents: {},	
	calendarInterval: null,
	calendarSelected: null,
	isCalendarUpdating: false,
	currentImageIndex: null,
	screenUpdateInterval: null,
	isCameraScreen: false,
	isMapScreen: false,
	cameras: [],
	backgroundType: null,
	init: function() {
		let that = this
		this.timeEl = document.querySelector('.time')
		this.dateEl = document.querySelector('.date')
		this.internetIconEl = document.querySelector('.status-internet i')

		that.setDateTime()
		that.bgTypeChange()
		that.checkNetwork()

		that.calendarListeners()
		that.getCalendar()


		that.getCamerasList()
		that.getWeather()
		that.stopPrognozisTm()

		that.updateMemoryInfo()
		
	},
	updateMemoryInfo: function() {
		$('.memoryInfo').html(`${(window.performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) } Kb`)
		if (window.performance.memory.usedJSHeapSize > window.performance.memory.jsHeapSizeLimit * 0.75) {
			$('.memoryInfo').css('color', 'red')
		}
		setTimeout(app.updateMemoryInfo, 1000)
	},
	stopPrognozisTm: function() {
		let that = app
		let prognozisStop = localStorage.getItem('prognozisStop')
		if (prognozisStop) {
			that.getStopPrognozis(function(){
				that.renderStopPrognozis()
			})
			setTimeout(app.stopPrognozisTm, 60000)
		}
	},
	bgTypeChange: function() {
		let that = app
		
		let backgroundTypeChangeInterval = localStorage.getItem('backgroundTypeChangeInterval')
		if (!backgroundTypeChangeInterval) {
			backgroundTypeChangeInterval = 100
		}

		let cameraDuration = localStorage.getItem('cameraDuration')
		let mapDuration = localStorage.getItem('mapDuration')

		let nextType = 'image'
		switch(app.backgroundType) {
			case 'image':
				nextType = 'cameras'
				break;
			case 'cameras' : 
				nextType = 'map'
				break;
			case 'map':
				nextType = 'image'
				break;
			default: 
				nextType = 'image'
		}

		if (nextType == 'cameras' && !cameraDuration) {
			nextType = 'map'
		}

		if (nextType == 'map' && !mapDuration) {
			nextType = 'image'
		}

		if (!navigator.onLine) {
			nextType = 'image'
		}

		app.backgroundType = nextType

		if (nextType == 'image') {
			app.processBackground()
			setTimeout(function() {
				that.bgTypeChange()
			}, backgroundTypeChangeInterval * 1000)
		} else if (nextType == 'cameras') {
			app.enableCameraScreen(cameraDuration)
		} else if (nextType == 'map') {
			app.enableMapScreen(mapDuration)
		}

		app.randomQuote()
	},
	enableMapScreen: function(mapDuration) {
		console.log('Map enable', new Date())
		let that = this

		this.showMap()
		setTimeout(function() {
			that.hideMap()
			that.bgTypeChange()
		}, mapDuration * 1000)			

	},
	enableCameraScreen: function(cameraDuration) {
		console.log('Camera enable', new Date())
		let that = this
		this.showCamerasScreen()
		setTimeout(function() {
			that.hideCameraScreen()
			that.bgTypeChange()
		}, cameraDuration * 1000)								
	},
	calendarListeners: function() {
		let that = app

		let calendarEvents = localStorage.getItem('calendarEvents')
		if (calendarEvents) {
			that.calendarEvents = JSON.parse(calendarEvents)
		}

		ipc.on('calendar', function(response, calendar) {

		})
		ipc.on('calendarEvent', function(response, cEvent) {
			// console.log(cEvent)
			if (cEvent.err) {
				return false
			}
			if (that.isCalendarUpdating) {
				that.isCalendarUpdating = false
				that.calendarEvents = {}
			}
			let model = null
			if (cEvent.event.model.uid) {
				model = cEvent.event.model
				that.calendarEvents[model.uid] = model
			} else {
				cEvent.event.subComponents.forEach((component) => {
					if (component.model.uid) {
						model = component.model
						that.calendarEvents[model.uid] = model
						return true
					}
				})
			}

			localStorage.setItem('calendarEvents', JSON.stringify(that.calendarEvents))

			if (that.updateCalendarTimer) {
				clearTimeout(that.updateCalendarTimer)
				that.updateCalendarTimer = null
			}

			that.updateCalendarTimer = setTimeout(function() {
				let datepicker = $('.calendar').datepicker().data('datepicker');
				datepicker.update({})
				that.showEventsList(that.calendarSelected? that.calendarSelected : (new Date()).toDateString())	
			}, 2000)
			
		})

		$('.calendar').datepicker({
			inline: true,
			firstDay: 1,
			onRenderCell: function(date, cellType) {
		        if (cellType == 'day') {
		        	let cDate = new Date(date)
		        	let events = that.getEventsByDate(date)

		        	if (events.length) {
		        		return {
						    html: (cDate.getDate() + `<span class="calendar-events">${events.length}</span>`), // Custom cell content
						    classes: '', // Extra css classes to cell
						    disabled: false, // true/false, if true, then cell will be disabled
						}
		        	}
		        	
		        }
		        // console.log(date)
		    },
		    onSelect(formattedDate, date, plugin) {
		    	that.calendarSelected = date
		    	that.showEventsList(date)
		    }
		})

		setInterval(function() {
			let datepicker = $('.calendar').datepicker().data('datepicker');
			datepicker.update({})
		}, 300000)
	},
	hideCameraScreen: function() {
		console.log('Camera hide', new Date())
		let that = this
		this.isCameraScreen = false		
		$('.cameras video').each(function() {
			videojs(this).dispose()
		})
		$('.cameras').html('')

	},
	toggleCameras: function() {
		if (this.isMapScreen) {
			this.hideMap()	
		}
		if (!this.isCameraScreen) {
			this.showCamerasScreen()
		} else {
			this.hideCameraScreen()
			this.isCameraScreen = false
			this.processBackground()
			
		}
	},
	toggleMap: function() {
		if (this.isCameraScreen) {
			this.isCameraScreen = false
			$('.cameras').html('')
		}
		if (!this.isMapScreen) {
			this.showMap()
		} else {
			this.hideMap()
			this.processBackground()
		}
	},
	setDateTime: function() {
		let date = new Date()
		let timeString  = date.getHours() + ':' + (date.getMinutes()< 10 ? '0' : '') + date.getMinutes() 
		if (app.timeEl.innerText != timeString) {
			app.timeEl.innerText = timeString
		}

		let dateString = date.toLocaleDateString('ru-RU', { weekday: 'long' }) + ', ' + date.toLocaleDateString('ru-RU', { month: 'long', day: 'numeric' });
		if (app.dateEl.innerText != dateString) {
			app.dateEl.innerText = dateString			
		}

		setTimeout(app.setDateTime, 200)
		
	},
	checkNetwork: function() {
		let that = app
		app.internetIconEl.classList.forEach((cls) => {
			app.internetIconEl.classList.remove(cls)
		})
		app.internetIconEl.classList.add('icon-hourglass-o')

		if (navigator.onLine) {
			that.internetIconEl.classList.remove('icon-hourglass-o')	
			that.internetIconEl.classList.add('icon-wifi')	
		} else {
			that.internetIconEl.classList.remove('icon-hourglass-o')	
			that.internetIconEl.classList.add('icon-flight')	
		}

		setTimeout(app.checkNetwork, 2000)
	},
	updateCalendarTimer: null,
	getCalendar: function() {
		let that = app

		if (!localStorage.getItem('webDavServer') || !localStorage.getItem('webDavUsername') || !localStorage.getItem('webDavPassword')) {
			return false
		}

		if (navigator.onLine) {
			app.isCalendarUpdating = true

			ipc.send('getCalendar', {
				user: localStorage.getItem('webDavUsername'),
				password: localStorage.getItem('webDavPassword'),
				server: localStorage.getItem('webDavServer'),
			})	
		}
		

		setTimeout(app.getCalendar, 30000)
	},
	getEventsByDate: function (date) {
		let that = this
		let events = []
    	let thisDate = new Date(date)
    	thisDate.setHours(0)
    	thisDate.setMinutes(0)
    	Object.keys(this.calendarEvents).forEach((uid) => {
    		let event = that.calendarEvents[uid]
    		let start = new Date(event.startDate)
    		start.setHours(0)
    		start.setMinutes(0)
    		let end = new Date(event.endDate)
    		end.setHours(0)
    		end.setMinutes(0)

    		if (!event.rrule) {
    			if (start <= thisDate && end >= thisDate) {
    				events.push(event)
    			}
    		} else {
    			if (start <= thisDate && event.rrule.bymonthday) {
    				if (thisDate.getDate() == event.rrule.bymonthday) {
    					events.push(event)
    				}
    			}
    		}

    	})

    	return events
	},
	showEventsList: function(date) {
		let that = this
		let events = this.getEventsByDate(date)
		let html = ''
		let eventList = document.querySelector('.calendar-events-list')

		if (!events.length) {
			eventList.classList.add('hidden')
		} else {
			eventList.classList.remove('hidden')
		}

		events.forEach((event) => {
			let start = new Date(event.startDate)
			let end = new Date(event.endDate)

			let htmlEvent = `<div class="calendar-event">
	            <div class="startTime ${ event.allDay? 'allday' :''}">
	              ${ event.allDay? 'all day' : `${start.getHours()}<sup>${that.getMinutes(start)}</sup>`}
	            </div>
	            <div class="endTime">
	              ${ event.allDay? '' : `${end.getHours()}<sup>${that.getMinutes(end)}</sup>`}
	            </div>
	            <div class="event-title">
	              ${ event.summary }
	            </div>
	            
            	${event.location? `
	            	<div class="event-location">
	            		<i class="icon-location">
	                		${event.location}
	              		</i>
	              	</div>
              ` : ''}	              
	        </div>`
	        html+= htmlEvent

		})

		eventList.innerHTML = html
		
	},
	getMinutes: function (date) {
		return (date.getMinutes()< 10 ? '0' : '') + date.getMinutes()
	},
	processBackground: function() {

		let background = localStorage.getItem('background')
		let imageUrl = localStorage.getItem('imageUrl')
		let dailyTerm = localStorage.getItem('dailyTerm')
		let randomTerm = localStorage.getItem('randomTerm')
		let url = null
		if (!background || app.isCameraScreen || app.isCameraScreen) {
			return false
		}

		if (!navigator.onLine) {
			background = 'downloaded_images'
		}

		switch (background) {
			case 'image':
				$('.screen-bg').css('background-image', `url('${imageUrl}')`)
				break;
			case 'random_image':
				url = `https://source.unsplash.com/1600x900/?${randomTerm}&t=${(new Date()).getTime()}`
				img = new Image();
				img.onload = function(){

				    $('.screen-bg').css('background-image', `url('${url}')`)					
				} 
				img.src = url;				
				break;	
				
			case 'daily_image':
				url = `https://source.unsplash.com/weekly?${dailyTerm}&t=${(new Date()).getTime()}`
				img = new Image();
				img.onload = function(){

				    $('.screen-bg').css('background-image', `url('${url}')`)					
				} 
				img.src = url;	
				break;
			case 'downloaded_images':
				let backgrounds = availableBackgrounds()
				if (app.currentImageIndex === null) {
					app.currentImageIndex = 0					
				} else {
					app.currentImageIndex = backgrounds.length == (app.currentImageIndex +1)? 0 : (app.currentImageIndex+1)			
				}
				$('.screen-bg').css('background-image', `url('./backgrounds/${backgrounds[app.currentImageIndex]}')`)
				break;
		}
	},
	showCamerasScreen: function() {
		$('.cameras').html('')
		
		let selectedCameras = localStorage.getItem('cameras')
		if (selectedCameras) {
			selectedCameras = JSON.parse(selectedCameras)
		} else {
			selectedCameras = []
		}
		let cCameras = this.cameras.filter((camera) => { return selectedCameras.includes(camera.stream_name) })
		let count = cCameras.length

		if (!count) {
			return false
		}
		cCameras.forEach((camera) => {
			let q = Math.ceil(Math.sqrt(count))
			$('.cameras').append(`
				<div class="camera">
					<video class="video-js" style="width: ${Math.floor(100 / q)}vw; height: ${Math.floor(100 / q)}vh;" autoplay muted>
				        <source src="${camera.stream_low_url}" type="application/x-mpegURL">
				    </video>
				</div>
			`)			
		})
		$('.camera video').each(function() {
			videojs(this)
		})
		$('.screen-bg').css('position', 'absolute')
		$('.screen-bg').css('background', 'none')
		this.isCameraScreen = true
	},
	getCamerasList: function(callback) {
		let that = app
		$.get('https://sevstar.net/oko/', function (data) {
			
			let json = data.split('cameras = ')[1].split('var map')[0].trim()

			json = json.substring(0, json.length-1)
			json = JSON.parse(json)
			that.cameras = json
			if (callback) {
				callback(json)	
			}			
			
		}).catch(function(e) {
			console.error(e)
		})

		setTimeout(app.getCamerasList, 10800000)
		
	},
	showMap: function() {
		this.isMapScreen = true
		$('.map').html(`
			<iframe id="f1" src="https://yandex.ru/maps/959/sevastopol/search/%D0%9F%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%20%D0%BF%D0%BE%D0%B1%D0%B5%D0%B4%D1%8B%2049/?l=masstransit&ll=33.561539%2C44.586053&sll=33.526402%2C44.556972&sspn=0.302811%2C0.115618&z=17" style="width: calc(100vw + 400px);margin-left: -400px;height: calc(100vh + 400px);margin-top: -230px;"></iframe>
		`)
		$('.screen-bg').css('position', 'absolute')
		$('.screen-bg').css('background', 'none')
		$('.statusBar').addClass('cmap')
	},
	hideMap: function() {
		console.log('Map hide', new Date())
		$('.map').html('')
		$('.statusBar').removeClass('cmap')	
		this.isMapScreen = false
	},
	getWeather: function() {
		let that = app
		let weatherCity = localStorage.getItem('weatherCity')
		if (weatherCity) {
			$.get(`https://api.openweathermap.org/data/2.5/weather?q=${weatherCity}&units=metric&appid=0d48c65818b71bba42c89e2ec7579ac1`, function(data) {
				$('.temp-block span').html(`${data.main.temp} ℃ (${data.main.feels_like} ℃)`)
				$('.wind-block span').html(`${data.wind.speed} m/s`)				
				
				var sheet = window.document.styleSheets[0];
				sheet.insertRule(`.wind-block i:before { transform: rotate(${data.wind.deg + 90}deg); }`, sheet.cssRules.length);

				$('.cloud-block span').html(`${data.clouds.all}%`)
				$('.state-block img').attr('src', `http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`)
				$('.state-block .state-name').html(data.weather[0].main)
				$('.state-block .state-description').html(data.weather[0].description)
			})

			$.get(`https://api.openweathermap.org/data/2.5/forecast?q=${weatherCity}&units=metric&appid=0d48c65818b71bba42c89e2ec7579ac1`, function(data) {
				let weatherByDate = {}
				data.list.forEach((record) => {
					let date = new Date(record.dt * 1000)
					let dateString = date.toLocaleDateString('ru-RU', {
						day: 'numeric',
						month: 'numeric',
					})

					if (!weatherByDate[dateString]) {
						weatherByDate[dateString] = []
					}
					weatherByDate[dateString].push(record)
				})
				let html = ''

				Object.keys(weatherByDate).forEach((date) => {
					let arr = weatherByDate[date]
					html += `
					<div class="forecastItem">
			        	<div class="forecastItem_date">${date}</div>
			        	<div class="forecastItem_list">${arr.map((weather) => {
			        		let dt = new Date(weather.dt * 1000)
			        		return `
			        		<div class="forecastItem_list_item">
			        			<div class="forecastItem_list_item_time">${dt.getHours()}<sup>h</sup></div>
			        			<div class="forecastItem_list_item_icon">
			        				<img src="http://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png" title="${weather.weather[0].main}">
			        			</div>
			        			<div class="forecastItem_list_item_data" title="(${weather.main.feels_like} ℃)">${weather.main.temp} ℃</div>
			        		</div>
			        	`}).join('')}</div>
			        </div>`
				})

				$('.weatherForecast').html(html)
			})
			$('.weather').removeClass('hidden')

			setTimeout(app.getWeather, 120000)
		}
		
	},
	yaCsrf: null,
	yaTransport: [],
	getStopPrognozis: function(callback) {
		let that = this
		let prognozisStop = localStorage.getItem('prognozisStop')
		if (!prognozisStop) {
			return false
		}
		$.get(`https://yandex.ru/maps/api/masstransit/getStopInfo?ajax=1&csrfToken=${this.yaCsrf}&id=${prognozisStop}&lang=ru&locale=ru_RU&mode=prognosis`, function(data) {
			if (data.csrfToken) {
				that.yaCsrf = data.csrfToken
				that.getStopPrognozis(callback)
				return false
			}

			let transport = data.data.properties.StopMetaData.Transport

			let transportData = []		

			transport.forEach((bus) => {
				bus.threads.forEach((thread) => {
					let haveEstimated = false
					let estimated = []

					if (!thread.BriefSchedule.Frequency) {
						return false
					}

					thread.BriefSchedule.Events.forEach((event) => {
						if (event.Estimated) {
							estimated.push({
								bus: bus.name,
								text: event.Estimated.text,
								time: event.Estimated.value,
								type: bus.type
							})
							haveEstimated = true
						}
					})

					transportData.push({
						bus: bus.name,
						start: thread.BriefSchedule.Frequency.begin.value,
						end: thread.BriefSchedule.Frequency.end.value,
						type: bus.type,
						frequency: thread.BriefSchedule.Frequency.value,
						estimated,
					})
				})
			})

			that.yaTransport = transportData
			if (callback) {
				callback()
			}
		})
	},
	renderStopPrognozis: function() {
		let that = this
		
		let html = ''
		app.yaTransport.forEach((transport) => {

			transportRegular = null				
			let startDate = new Date(transport.start * 1000)
			let endDate = new Date(transport.end * 1000)

			let cDate = new Date()

			if (cDate >= startDate && cDate <= endDate) {
				let sDate = new Date(transport.start * 1000)
				while (sDate < cDate) {
					sDate.setTime(sDate.getTime() + transport.frequency * 1000)
				}
				if (sDate <= endDate) {
					transportRegular = sDate.toLocaleString('ru-RU', {
						hour:'numeric',
						minute: 'numeric'
					}) 	
				}
				
			}

			if (!transportRegular && !transport.estimated.length) {
				return false;
			}
			
			let hasNowItem = false
			html += `
			<div class="transport__item">
	            <div class="transport__item__title"><i class="icon-bus"></i>${transport.type == 'trolleybus'? 'T' : ''}${transport.bus}${transport.type == 'minibus'? '<sup>m</sup>' : ''}</div>
	            <div class="transport__item__estimated">
	            	${transport.estimated.map((estimated, index) => {	            		

	            		if (hasNowItem) {
	            			return ''
	            		}
	            		if ((new Date(estimated.time * 1000)) < (new Date())) {
	            			hasNowItem = true
	            		}
	            		if (index > 2) {
	            			return ''
	            		}
	            		return `
	            		<div class="transport__item__estimated__item">
		                  <i class="icon-circle"></i><span>${estimated.text}</span>
		                </div>	
	            	`}).join('')}		
	            	${transportRegular? `

	            		<div class="transport__item__estimated__item">
		                  <i class="icon-circle-empty"></i><span>${transportRegular}</span>
		                </div>

	            	` : ''}            
	                
	            </div>
	        </div>`
		})

		if (that.yaTransport.length) {
			$('.transport').removeClass('hidden')
		} else {
			$('.transport').addClass('hidden')
		}
		$('.transport').html(html)
		
	},
	randomQuote: function() {
		var quote = window.quotes[Math.floor(Math.random()*window.quotes.length)];
		$('.quote__title').html(quote.text.split('.').slice(1, -1).join('.').trim())
		$('.quote__author').html(quote.author)
	}


}
document.addEventListener('DOMContentLoaded', function(){
	app.init()
})
