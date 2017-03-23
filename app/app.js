const game = new Phaser.Game(2600, 1400, Phaser.AUTO, 'game', {preload: preload, create: create, update: update, render:render});

function preload(){
	game.load.image('background', 'assets/images/yellow.png');
	game.load.image('endTurn', 'assets/images/button.png');
	game.load.image('attack', 'assets/images/atk.png');

	game.load.spritesheet('cardback', 'assets/images/CARDBACK.jpg');
	game.load.spritesheet('cardface', 'assets/images/cardface.png');

	game.load.spritesheet('katana', 'assets/images/katana.jpg');
	game.load.spritesheet('claymore', 'assets/images/claymore.jpg');

	game.load.text('cardSet', 'assets/data/settings.json');
}

// server

var socket = io();
const roomID = location.search.replace(/\?roomID=/, '');

socket.on('buildLIFE', it => {
  alert('your: '+it.yourCard +' / '+ 'foe: '+it.foeCard);
  LIFE.push(new Card(it.yourCard, 'life', true, true, true));
  foeLIFE.push(new Card(it.foeCard, 'life', false, false, true));
})

socket.on('gameStart', it => {
  alert(it.msg)
})

socket.on('foeDrawCard', it => {
	foeHAND.push(new Card(it.foeCard, 'hand', false, false, true));
})

socket.on('foePlayCard', it => { // it = the card name
  /* 1. find foe hand for that card
   * 2. push it to battle by pop it out from hand
   */
})


// game variables
var playerName;

var DECK = [];
var HAND = [];
var LIFE = [];
var GRAVE = [];
var BATTLE = [];

var foeDECK = [];
var foeHAND = [];
var foeLIFE = [];
var foeBATTLE = [];
var foeGRAVE = [];

var display = {
	screenWidth: 2600,
	screenHeight: 1400,
	cardWidth: 120,
	cardHeight: 165
};

var msg = {
	field: "",
	name: ""
};

var Card = function (name, field, faceInput, backInput, cover){
	this.field = field;
	this.cover = cover;

	this.faceGroup = game.add.group();
	this.backGroup = game.add.group();
	this.face = game.add.sprite(display.screenWidth - 200, display.screenHeight - 200, name);
	this.faceGroup.add(this.face);
	this.back = game.add.sprite(display.screenWidth - 200, display.screenHeight - 200, 'cardback');
	this.backGroup.add(this.back);
	this.face.inputEnabled = faceInput;
	this.face.events.onInputDown.add(this.playCard, this);
	this.back.inputEnabled = backInput;
	this.back.events.onInputDown.add(this.drawCard, this);

	this.face.name = name;
};

Card.prototype.changeInputFunction = function(){
	if(this.field === "hand"){
		this.face.events.onInputDown.removeAll();
		this.back.events.onInputDown.removeAll();
		if((this.cardType === "artifact")){
		    this.face.events.onInputDown.add(this.playCard, this);
	    }
	}

	if(this.field === "life"){
		this.face.events.onInputDown.removeAll();
		this.back.events.onInputDown.removeAll();
		if((this.cardType === "artifact")){
			this.face.events.onInputDown.add(this.playCard, this);
		}
		this.back.events.onInputDown.add(this.checkCard, this);
	}

	if(this.field === "battle"){
		this.face.events.onInputDown.removeAll();
		this.back.events.onInputDown.removeAll();
		if((this.cardType === "artifact")){
			this.face.events.onInputDown.add(this.activateCard, this);
		}
	}

	if(this.field === "grave"){
		this.face.events.onInputDown.removeAll();
		this.back.events.onInputDown.removeAll();
	}
};

Card.prototype.drawCard = function(){
	msg.field = this.field;
	msg.name = this.face.name;
	//console.log(JSON.stringify(msg));

  socket.emit('drawCard', roomID, JSON.stringify(msg), it => {
    alert(it.yourCard);
    if(it.yourCard !== 'foeTurn'){
	    HAND.push(new Card(it.yourCard, 'hand', true, true, false));
    }
  });

};

Card.prototype.playCard = function(){
	msg.field = this.field;
	msg.name = this.face.name;
	console.log(JSON.stringify(msg));
  /*
	this.field = "battle";

	for(var i = 0; i < HAND.length; i++){
	    if(HAND[i].back.name === this.back.name){
	        BATTLE.push(HAND[i]);
	        HAND.splice(i,1);
	    }
	}
	this.changeInputFunction();
  */
};

Card.prototype.activateCard = function(){
	msg.field = this.field;
	msg.name = this.face.name;
	console.log(JSON.stringify(msg));
	this.changeInputFunction();
}

Card.prototype.checkCard = function(){
	msg.field = this.field;
	msg.name = this.face.name;
	console.log(JSON.stringify(msg));

	this.changeInputFunction();
};


function endTurn(){
  socket.emit('finish', roomID, it => {alert(it.msg)});
}


function create(){
	//cardSet = JSON.parse(game.cache.getText('cardSet'));
  game.physics.startSystem(Phaser.Physics.ARCADE);
	game.add.tileSprite(0, 0, display.screenWidth, display.screenHeight, 'background');
	game.world.setBounds(0, 0, display.screenWidth, display.screenHeight);

  socket.emit('login', {roomID: roomID}, it => {

    alert(it.msg)

    // create DECK
	  DECK.push(new Card('topDeck', 'deck', true, true, true));

    // create foe DECK
	  foeDECK.push(new Card('topDeck', 'deck', false, false, true));

    var button1 = game.add.button(display.screenWidth - 230, display.screenHeight/2 - 150, 'endTurn', endTurn, this);
  });

}

function update(){


  // card composing
		for(var i = 0; i < HAND.length; i++){
			if(HAND[i].cover == false){
				game.world.bringToTop(HAND[i].faceGroup);
		    }
			HAND[i].face.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(HAND.length - 1) + (display.cardWidth*6/5)*i;
			HAND[i].back.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(HAND.length - 1) + (display.cardWidth*6/5)*i;
			HAND[i].face.y = display.screenHeight - 400;
			HAND[i].back.y = display.screenHeight - 400;
		}

		for(var i = 0; i < DECK.length; i++){

		}

		for(var i = 0; i < LIFE.length; i++){
	        if(LIFE[i].cover == false){
	            game.world.bringToTop(LIFE[i].faceGroup);
	        }
	        else{
		        game.world.bringToTop(LIFE[i].backGroup);
		    }
		    LIFE[i].face.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(LIFE.length - 1) + (display.cardWidth*6/5)*i;
		    LIFE[i].back.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(LIFE.length - 1) + (display.cardWidth*6/5)*i;
		    LIFE[i].face.y = display.screenHeight - 200;
		    LIFE[i].back.y = display.screenHeight - 200;
		}

		for(var i = 0; i < BATTLE.length; i++){
		    BATTLE[i].face.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(BATTLE.length - 1) + (display.cardWidth*6/5)*i;
			BATTLE[i].back.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(BATTLE.length - 1) + (display.cardWidth*6/5)*i;
			BATTLE[i].face.y = display.screenHeight - 600;
			BATTLE[i].back.y = display.screenHeight - 600;
		}

		for(var i = 0; i < GRAVE.length; i++){
		    GRAVE[i].face.x = display.screenWidth - 200;
			GRAVE[i].back.x = display.screenWidth - 200;
			GRAVE[i].face.y = display.screenHeight - 400;
			GRAVE[i].back.y = display.screenHeight - 400;
		}


    // foe card place

		for(var i = 0; i < foeDECK.length; i++){
      foeDECK[i].face.x = display.screenWidth - 200;
      foeDECK[i].back.x = display.screenWidth - 200;
      foeDECK[i].face.y = display.screenHeight - 1368;
      foeDECK[i].back.y = display.screenHeight - 1368;
		}

    for(var i = 0; i < foeHAND.length; i++){
			foeHAND[i].face.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(foeHAND.length - 1) + (display.cardWidth*6/5)*i;
			foeHAND[i].back.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(foeHAND.length - 1) + (display.cardWidth*6/5)*i;
			foeHAND[i].face.y = display.screenHeight -1168;
			foeHAND[i].back.y = display.screenHeight - 1168;
    }

		for(var i = 0; i < foeLIFE.length; i++){
		    foeLIFE[i].face.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(foeLIFE.length - 1) + (display.cardWidth*6/5)*i;
		    foeLIFE[i].back.x = (display.screenWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(foeLIFE.length - 1) + (display.cardWidth*6/5)*i;
		    foeLIFE[i].face.y = display.screenHeight - 1368;
		    foeLIFE[i].back.y = display.screenHeight - 1368;
		}

}

function render(){
}




