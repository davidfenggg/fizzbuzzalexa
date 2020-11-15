// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// Licensed under the Amazon Software License
// http://aws.amazon.com/asl/

/* eslint-disable  func-names */
/* eslint-disable  no-console */
/* eslint-disable  no-restricted-syntax */
const Alexa = require('ask-sdk');
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');
const languageStrings = {
  'en': require('./languageStrings')
}
const AWS = require('aws-sdk');

// initial value of the fizz buzz game
var value = 1;

// converts the value integer to the correct answer
// if value is divisible by three, it returns "Fizz"
// if value is divisible by five, it returns "Buzz"
// if value is divisible by three and five, it returns "Fizz Buzz"
// otherwise, it returns the value in string format
function makeString (x) {
    if (x % 15 === 0){
        return "Fizz Buzz";
    } else if (x % 5 === 0) {
        return "Buzz"
    } else if (x % 3 === 0) {
        return "Fizz"
    } else {
        return x.toString();
    }
}

// This is the request to launch the game 
const LaunchRequest = {
  canHandle(handlerInput) {
    // launch requests as well as any new session, as games are not saved in progress, which makes
    // no one shots a reasonable idea except for help, and the welcome message provides some help.
    return Alexa.isNewSession(handlerInput.requestEnvelope) 
      || Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  async handle(handlerInput) {
    // keeps track of the state of the game (mainly whether it is being played)
    const { attributesManager } = handlerInput;
    const requestAttributes = attributesManager.getRequestAttributes();
    const attributes = await attributesManager.getPersistentAttributes() || {};

    // sets the beginning state of the game
    if (Object.keys(attributes).length === 0) {
      attributes.gameState = 'ENDED';
    }

    attributesManager.setSessionAttributes(attributes);

    const speakOutput = requestAttributes.t('WELCOME_MESSAGE');
    const reprompt = requestAttributes.t('CONTINUE_MESSAGE');

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(reprompt)
      .getResponse();
  },
};

// handles the program if the user wants to quit or exit from the game
const ExitHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
        || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    // resets the value back to 1, which is the initial value
    value = 1;
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();

    return handlerInput.responseBuilder
      .speak(requestAttributes.t('EXIT_MESSAGE'))
      .getResponse();
  },
};

// handles the program if the user wants to end the entire session
const SessionEndedRequest = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  // resets the value back to 1 and logs the reason why the session ended
  handle(handlerInput) {
    value = 1;
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

// handles the help call while the game is being played
const HelpNumberIntent = {
  canHandle(handlerInput) {
    // handle help intents only during a game
    let isCurrentlyPlaying = false;
    const { attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    if (sessionAttributes.gameState &&
      sessionAttributes.gameState === 'STARTED') {
      isCurrentlyPlaying = true;
    }

    return isCurrentlyPlaying 
      && Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const requestAttributes = attributesManager.getRequestAttributes();
    const sessionAttributes = attributesManager.getSessionAttributes();
    
    // provides the necessary help message and options when the game is in play
    return handlerInput.responseBuilder
    .speak(requestAttributes.t('HELP_GAME_MESSAGE'))
    .reprompt(requestAttributes.t('HELP_REPROMPT'))
    .getResponse();
  },
};

// handles the situation when the user wants to play the game
const YesIntent = {
  canHandle(handlerInput) {
    // only start a new game if yes is said when not playing a game.
    let isCurrentlyPlaying = false;
    const { attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    if (sessionAttributes.gameState &&
      sessionAttributes.gameState === 'STARTED') {
      isCurrentlyPlaying = true;
    }

    return !isCurrentlyPlaying 
      && Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
      && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent' 
      || Alexa.getIntentName(handlerInput.requestEnvelope) === 'PlayIntent') ;
  },
  handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const requestAttributes = attributesManager.getRequestAttributes();
    const sessionAttributes = attributesManager.getSessionAttributes();

    // sets the gameState to 'STARTED' because the game started, and sets the value to
    // 2, which is the next expected value after the output is stoken
    sessionAttributes.gameState = 'STARTED';
    const speakOutput = `Okay, let's play! I'll start. ${makeString(value)}.`;
    value = 2;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(requestAttributes.t('HELP_REPROMPT'))
      .getResponse();
  },
};

// handles the situation where the user does not want to play a game from the menu
const NoIntent = {
  canHandle(handlerInput) {
    // only treat no as an exit when outside a game
    let isCurrentlyPlaying = false;
    const { attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    if (sessionAttributes.gameState &&
      sessionAttributes.gameState === 'STARTED') {
      isCurrentlyPlaying = true;
    }

    return !isCurrentlyPlaying 
      && Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent';
  },
  async handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const requestAttributes = attributesManager.getRequestAttributes();
    const sessionAttributes = attributesManager.getSessionAttributes();

    sessionAttributes.gameState = 'ENDED';
    attributesManager.setPersistentAttributes(sessionAttributes);

    await attributesManager.savePersistentAttributes();

    return handlerInput.responseBuilder
      .speak(requestAttributes.t('EXIT_MESSAGE'))
      .getResponse();

  },
};

// handles the user's request for instructions during the game
const InstructionsInGameIntent = {
    // only run this handler if the game is in session
  canHandle(handlerInput) {
    const { attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    return (sessionAttributes.gameState === 'STARTED')
    && Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
    && Alexa.getIntentName(handlerInput.requestEnvelope) === 'InstructionsIntent';
  },
  handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const requestAttributes = attributesManager.getRequestAttributes();
    const sessionAttributes = attributesManager.getSessionAttributes();

    sessionAttributes.gameState = 'STARTED';

    return handlerInput.responseBuilder
    .speak(requestAttributes.t('IN_GAME_INSTRUCTIONS'))
    .reprompt(requestAttributes.t('HELP_REPROMPT'))
    .getResponse();
   
  },
};

// handles the user's request for instructions at the beginning of the game before it starts
const InstructionsIntent = {
    // handles this intent only when the game is not in session
  canHandle(handlerInput) {
    const { attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    return (sessionAttributes.gameState === 'ENDED')
    && Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
    && Alexa.getIntentName(handlerInput.requestEnvelope) === 'InstructionsIntent';
  },
  handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const requestAttributes = attributesManager.getRequestAttributes();
    const sessionAttributes = attributesManager.getSessionAttributes();

    sessionAttributes.gameState = 'ENDED';

    return handlerInput.responseBuilder
    .speak(requestAttributes.t('INSTRUCTIONS_MESSAGE'))
    .reprompt(requestAttributes.t('HELP_REPROMPT'))
    .getResponse();
   
  },
};

// handles the guessing of the next NUMBER (not fizz or buzz) from the user
const NumberGuessIntent = {
  canHandle(handlerInput) {
    // handle numbers and guesses only during a game
    let isCurrentlyPlaying = false;
    const { attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    if (sessionAttributes.gameState &&
      sessionAttributes.gameState === 'STARTED') {
      isCurrentlyPlaying = true;
    }

    return isCurrentlyPlaying 
      && Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'NumberGuessIntent';
  },
  async handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const requestAttributes = attributesManager.getRequestAttributes();
    const sessionAttributes = attributesManager.getSessionAttributes();
    
    // gets the number that was guessed by the user
    const guessNum = parseInt(Alexa.getSlotValue(handlerInput.requestEnvelope, 'number'), 10);
    
    // checks if the number guessed is the correct answer, if it is, the game continues 
    // by increasing the value and saying the next term. if not, the session is ended, the value
    // is reset, and the correct answer is told to the user
    if (guessNum === value && value % 5 !== 0 && value % 3 !== 0){
        value += 2;
        return handlerInput.responseBuilder
        .speak(makeString(value - 1))
        .reprompt(requestAttributes.t('TOO_HIGH_REPROMPT'))
        .getResponse();
    }
    else {
        const correctValue = value;
        value = 1;
        sessionAttributes.gameState = 'ENDED';
        return handlerInput.responseBuilder
        .speak(`I'm sorry. The correct answer was ${makeString(correctValue)}. Say yes to play again or no to quit.`)
        .reprompt(requestAttributes.t('TOO_HIGH_REPROMPT'))
        .getResponse();
    }
  },
};

// handles the case where the user wants Alexa to repeat the number/term that was just said
const RepeatNumberIntent = {
canHandle(handlerInput) {
    // handle repeat intents only during a game
    let isCurrentlyPlaying = false;
    const { attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    if (sessionAttributes.gameState &&
      sessionAttributes.gameState === 'STARTED') {
      isCurrentlyPlaying = true;
    }

    return isCurrentlyPlaying 
      && Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.RepeatIntent';
  },
   handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const requestAttributes = attributesManager.getRequestAttributes();
    const sessionAttributes = attributesManager.getSessionAttributes();
    
    return handlerInput.responseBuilder
    .speak(makeString(value - 1))
    .reprompt(requestAttributes.t('HELP_REPROMPT'))
    .getResponse();

  },
}

// handles the case where the user guesses Fizz, Buzz, or Fizz Buzz, not when
// the user guesses a number
const FizzBuzzGuessIntent = {
  canHandle(handlerInput) {
    // handle the fizz or buzz intent only during a game
    let isCurrentlyPlaying = false;
    const { attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    if (sessionAttributes.gameState &&
      sessionAttributes.gameState === 'STARTED') {
      isCurrentlyPlaying = true;
    }

    return isCurrentlyPlaying 
      && Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'FizzBuzzGuessIntent';
  },
  async handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const requestAttributes = attributesManager.getRequestAttributes();
    const sessionAttributes = attributesManager.getSessionAttributes();
    
    // gets what the user said back to Alexa 
    const fizzBuzz = Alexa.getSlotValue(handlerInput.requestEnvelope, 'response');
    
    // if the user's answer matches the correct answer, the game continues by increasing the value
    // and having Alexa say the next term in the sequence. if the user's answer is incorrect, the game
    // is ended, the value is reset, and the correct answer is told to the user
    if (fizzBuzz.toUpperCase() === makeString(value).toUpperCase()){
        value += 2;
        return handlerInput.responseBuilder
        .speak(makeString(value - 1))
        .reprompt(requestAttributes.t('HELP_MESSAGE'))
        .getResponse();
    } else {
        const correctValue = value;
        value = 1;
        sessionAttributes.gameState = 'ENDED';
        return handlerInput.responseBuilder
        .speak(`I'm sorry. The correct answer was ${makeString(correctValue)}. Say yes to play again or no to quit.`)
        .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
        .getResponse();
    }
  },
};

// handles the case where the intent is unknown
const UnhandledIntent = {
  canHandle() {
    return true;
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    value = 1;

    return handlerInput.responseBuilder
      .speak(requestAttributes.t('CONTINUE_MESSAGE'))
      .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
      .getResponse();
  },
};

// handles the case where there is an error in the game
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
     value = 1;
    console.log(`Error handled: ${error.message}`);
    console.log(`Error stack: ${error.stack}`);
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();

    return handlerInput.responseBuilder
      .speak(requestAttributes.t('ERROR_MESSAGE'))
      .reprompt(requestAttributes.t('ERROR_MESSAGE'))
      .getResponse();
  },
};

// handles the default fallback intent
const FallbackHandler = {
  canHandle(handlerInput) {
    // handle fallback intent, yes and no when playing a game
    // for yes and no, will only get here if and not caught by the normal intent handler
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent' 
      || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent'
      || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent');
  },
  handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const requestAttributes = attributesManager.getRequestAttributes();
    const sessionAttributes = attributesManager.getSessionAttributes();

    if (sessionAttributes.gameState && sessionAttributes.gameState === 'STARTED') {
      // currently playing
      return handlerInput.responseBuilder
        .speak(requestAttributes.t('FALLBACK_MESSAGE_DURING_GAME'))
        .reprompt(requestAttributes.t('FALLBACK_REPROMPT_DURING_GAME'))
        .getResponse();
    }

    // not playing
    return handlerInput.responseBuilder
      .speak(requestAttributes.t('FALLBACK_MESSAGE_OUTSIDE_GAME'))
      .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
      .getResponse();
  },
};

const LocalizationInterceptor = {
  process(handlerInput) {
    const localizationClient = i18n.use(sprintf).init({
      lng: Alexa.getLocale(handlerInput.requestEnvelope),
      resources: languageStrings,
    });
    localizationClient.localize = function localize() {
      const args = arguments;
      const values = [];
      for (let i = 1; i < args.length; i += 1) {
        values.push(args[i]);
      }
      const value = i18n.t(args[0], {
        returnObjects: true,
        postProcess: 'sprintf',
        sprintf: values,
      });
      if (Array.isArray(value)) {
        return value[Math.floor(Math.random() * value.length)];
      }
      return value;
    };
    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function translate(...args) {
      return localizationClient.localize(...args);
    };
  },
};

function getPersistenceAdapter() {
  // Determines persistence adapter to be used based on environment
  const dynamoDBAdapter = require('ask-sdk-dynamodb-persistence-adapter');
  return new dynamoDBAdapter.DynamoDbPersistenceAdapter({
    tableName: process.env.DYNAMODB_PERSISTENCE_TABLE_NAME,
    createTable: false,
    dynamoDBClient: new AWS.DynamoDB({apiVersion: 'latest', region: process.env.DYNAMODB_PERSISTENCE_REGION})
  });
}

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .withPersistenceAdapter(getPersistenceAdapter())
  .addRequestHandlers(
    LaunchRequest,
    NumberGuessIntent,
    FizzBuzzGuessIntent,
    ExitHandler,
    InstructionsIntent,
    SessionEndedRequest,
    HelpNumberIntent,
    RepeatNumberIntent,
    InstructionsInGameIntent,
    YesIntent,
    NoIntent,
    FallbackHandler,
    UnhandledIntent,
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();