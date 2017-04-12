const w = document.documentElement.clientWidth
const h = document.documentElement.clientHeight
const ratio = w/h

const game = new Phaser.Game(2600, 2600/ratio, Phaser.AUTO, 'game', {preload: preload, create: create, update: update, render:render})

function preload(){
	game.load.image('background', 'assets/images/yellow.png')
	game.load.image('endTurn', 'assets/images/button.png')
	game.load.image('attack', 'assets/images/atk.png')

	game.load.spritesheet('cardback', 'assets/images/CARDBACK.jpg')
	game.load.spritesheet('cardface', 'assets/images/cardface.png')

	game.load.spritesheet('katana', 'assets/images/katana.jpg')
	game.load.spritesheet('claymore', 'assets/images/claymore.jpg')
  game.load.spritesheet('judge', 'assets/images/judge.jpg')
  game.load.spritesheet('hawkeye', 'assets/images/hawkeye.jpg')
  game.load.spritesheet('aquarius', 'assets/images/aquarius.jpg')
  game.load.spritesheet('vesper', 'assets/images/vesper.jpg')
  game.load.spritesheet('doom', 'assets/images/doom.jpg')
  game.load.spritesheet('aria', 'assets/images/aria.jpg')
  game.load.spritesheet('shadow', 'assets/images/shadow.jpg')
  game.load.spritesheet('muse', 'assets/images/muse.jpg')
}

// server

var socket = io()
const roomID = location.search.replace(/\?roomID=/, '')

socket.on('buildLIFE', it => {
  var life = JSON.parse(it)
  for(var i = 0; i < life.length; i++){
    LIFE.push(new Card(life[i].toString(), 'life', true, true, true))
    LIFE[i].changeInputFunction()
  }
})

socket.on('foeBuiltLife', it => {
  for(var i = 0; i < 6; i++){
    foeLIFE.push(new Card('unknown', 'life', false, false, true))
  }
})


socket.on('gameStart', it => {
  //alert(it.msg)
  text.setText(it.msg)
})

socket.on('turnStart', it => {
  text.setText(it.msg)
})

socket.on('foeDrawCard', it => {
   foeHAND.push(new Card('unknown', 'hand', false, false, true))
})

socket.on('foePlayCard', it => {

})


// game variables
var playerName

var DECK = []
var HAND = []
var LIFE = []
var GRAVE = []
var BATTLE = []

var foeDECK = []
var foeHAND = []
var foeLIFE = []
var foeBATTLE = []
var foeGRAVE = []

var display = {
	screenWidth: 2600,
	screenHeight: 2600/ratio,
	cardWidth: 120,
	cardHeight: 165,
  hRatio: 1400*ratio/2600
};

var msg = {
	field: "",
	name: ""
};

var Card = function (name, field, faceInput, backInput, cover){
	this.field = field
	this.cover = cover

	this.faceGroup = game.add.group()
	this.backGroup = game.add.group()
	this.face = game.add.sprite(display.screenWidth - 200, display.screenHeight - 200/display.hRatio, name)
	this.faceGroup.add(this.face)
	this.back = game.add.sprite(display.screenWidth - 200, display.screenHeight - 200/display.hRatio, 'cardback')
	this.backGroup.add(this.back)
	this.face.inputEnabled = faceInput
	this.face.events.onInputDown.add(this.playCard, this)
	this.back.inputEnabled = backInput
	this.back.events.onInputDown.add(this.drawCard, this)

	this.face.name = name
}

Card.prototype.changeInputFunction = function(){
	if(this.field === "hand"){
		this.face.events.onInputDown.removeAll()
		this.back.events.onInputDown.removeAll()
		if((this.cardType === "artifact")){
		    this.face.events.onInputDown.add(this.playCard, this)
	    }
	}

	if(this.field === "life"){
		this.face.events.onInputDown.removeAll()
		this.back.events.onInputDown.removeAll()
		if((this.cardType === "artifact")){
			this.face.events.onInputDown.add(this.playCard, this)
		}
		this.back.events.onInputDown.add(this.checkCard, this)
	}

	if(this.field === "battle"){
		this.face.events.onInputDown.removeAll()
		this.back.events.onInputDown.removeAll()
		if((this.cardType === "artifact")){
			this.face.events.onInputDown.add(this.activateCard, this)
		}
	}

	if(this.field === "grave"){
		this.face.events.onInputDown.removeAll()
		this.back.events.onInputDown.removeAll()
	}
}

Card.prototype.drawCard = function(){
	msg.field = this.field
	msg.name = this.face.name
	//console.log(JSON.stringify(msg))

  socket.emit('drawCard', roomID, JSON.stringify(msg), it => {
    //alert(it.yourCard)

    if(it.yourCard !== 'foeTurn'){
      text.setText('draw '+it.yourCard)
      HAND.push(new Card(it.yourCard, 'hand', true, true, false))
      HAND[HAND.length - 1].changeInputFunction()
    }
    else{
      text.setText('waiting for opponent')
    }
  })

}

Card.prototype.playCard = function(){
	msg.field = this.field
	msg.name = this.face.name
	console.log(JSON.stringify(msg))
  /*
	this.field = "battle"

	for(var i = 0; i < HAND.length; i++){
	    if(HAND[i].back.name === this.back.name){
	        BATTLE.push(HAND[i])
	        HAND.splice(i,1)
	    }
	}
	this.changeInputFunction()
  */
}

Card.prototype.activateCard = function(){
	msg.field = this.field
	msg.name = this.face.name
	console.log(JSON.stringify(msg))
	this.changeInputFunction()
}

Card.prototype.checkCard = function(){
	msg.field = this.field
	msg.name = this.face.name
	console.log(JSON.stringify(msg))

	this.changeInputFunction()
}


function endTurn(){
  socket.emit('finish', roomID, it => {text.setText(it.msg)})
}


function create(){
  game.physics.startSystem(Phaser.Physics.ARCADE)
	game.add.tileSprite(0, 0, display.screenWidth, display.screenHeight, 'background')
	game.world.setBounds(0, 0, display.screenWidth, display.screenHeight)
  game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL

  text = game.add.text(0,0, 'matching opponent...', {font: ' 50px Arial', fill:'#ffffff', align: 'left'})
  text.fixedToCamera = true
  text.cameraOffset.setTo(40, display.screenHeight/2 - 80/display.hRatio)

  socket.emit('login', {roomID: roomID}, it => {
    //alert(it.msg)

    // create DECK
	  DECK.push(new Card('topDeck', 'deck', true, true, true))

    // create foe DECK
	  foeDECK.push(new Card('topDeck', 'deck', false, false, true))

    var button1 = game.add.button(display.screenWidth - 230, display.screenHeight/2 - 80/display.hRatio, 'endTurn', endTurn, this)
  })

}

function update(){


  // card composing
		for(var i = 0; i < HAND.length; i++){
			if(HAND[i].cover == false){
				game.world.bringToTop(HAND[i].faceGroup)
		    }
			HAND[i].face.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(HAND.length - 1) + (display.cardWidth*6/5)*i
			HAND[i].back.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(HAND.length - 1) + (display.cardWidth*6/5)*i
			HAND[i].face.y = display.screenHeight - 400/display.hRatio
			HAND[i].back.y = display.screenHeight - 400/display.hRatio
		}

		for(var i = 0; i < DECK.length; i++){

		}

		for(var i = 0; i < LIFE.length; i++){
	        if(LIFE[i].cover == false){
	            game.world.bringToTop(LIFE[i].faceGroup)
	        }
	        else{
		        game.world.bringToTop(LIFE[i].backGroup)
		    }
		    LIFE[i].face.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(LIFE.length - 1) + (display.cardWidth*6/5)*i
		    LIFE[i].back.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(LIFE.length - 1) + (display.cardWidth*6/5)*i
		    LIFE[i].face.y = display.screenHeight - 200/display.hRatio
		    LIFE[i].back.y = display.screenHeight - 200/display.hRatio
		}

		for(var i = 0; i < BATTLE.length; i++){
		  BATTLE[i].face.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(BATTLE.length - 1) + (display.cardWidth*6/5)*i
			BATTLE[i].back.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(BATTLE.length - 1) + (display.cardWidth*6/5)*i
			BATTLE[i].face.y = display.screenHeight - 600/display.hRatio
			BATTLE[i].back.y = display.screenHeight - 600/display.hRatio
		}

		for(var i = 0; i < GRAVE.length; i++){
		    GRAVE[i].face.x = display.screenWidth - 200
			GRAVE[i].back.x = display.screenWidth - 200
			GRAVE[i].face.y = display.screenHeight - 400/display.hRatio
			GRAVE[i].back.y = display.screenHeight - 400/display.hRatio
		}


    // foe card place

		for(var i = 0; i < foeDECK.length; i++){
      foeDECK[i].face.x = display.screenWidth - 200
      foeDECK[i].back.x = display.screenWidth - 200
      foeDECK[i].face.y = display.screenHeight - 1368/display.hRatio
      foeDECK[i].back.y = display.screenHeight - 1368/display.hRatio
		}

    for(var i = 0; i < foeHAND.length; i++){
			foeHAND[i].face.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(foeHAND.length - 1) + (display.cardWidth*6/5)*i
			foeHAND[i].back.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(foeHAND.length - 1) + (display.cardWidth*6/5)*i
			foeHAND[i].face.y = display.screenHeight - 1168/display.hRatio
			foeHAND[i].back.y = display.screenHeight - 1168/display.hRatio
    }

		for(var i = 0; i < foeLIFE.length; i++){
		    foeLIFE[i].face.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(foeLIFE.length - 1) + (display.cardWidth*6/5)*i
		    foeLIFE[i].back.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(foeLIFE.length - 1) + (display.cardWidth*6/5)*i
		    foeLIFE[i].face.y = display.screenHeight - 1368/display.hRatio
		    foeLIFE[i].back.y = display.screenHeight - 1368/display.hRatio
		}

}

function render(){
}




