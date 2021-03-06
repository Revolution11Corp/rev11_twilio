const VoiceResponse = require('twilio').twiml.VoiceResponse;
const queryParser = require("query-string");
const sworm = require("sworm");
const awsParamStore = require('aws-param-store');

const util = require('util')
///Get environment variables

//Database credentials
const user = awsParamStore.getParameterSync(process.env.ACCOUNT).Value
const password = awsParamStore.getParameterSync(process.env.PASSWORD).Value
const host = awsParamStore.getParameterSync(process.env.SERVER).Value
const port = awsParamStore.getParameterSync(process.env.PORT).Value
const db_name = awsParamStore.getParameterSync(process.env.DATABASE).Value
const db_driver= awsParamStore.getParameterSync(process.env.DRIVER).Value

//Database column names:
//These are hardcoded because they are numerous, but are written in this section for regrouping reasons
const table_names = {
    voice_call_request:"voice_call_request",
    voice_call_result:"voice_call_result",
    voice_call_template:"voice_call_template",
    voice_call_question:"voice_call_question",
    voice_call_answer:"voice_call_answer",
    voice_call_verb:"voice_call_verb"
}


const table_voice_call_request = {
    id:"id",
    id_voice_call_template:"id_voice_call_template",
    name:"name",
    phone_num:"phone_num",
    button_serial:"button_serial",
    twilio_voice_id:"twilio_voice_id"
}

const table_voice_call_result = {
    id:"id",
    id_voice_call_request:"id_voice_call_request",
    id_voice_call_question:"id_voice_call_question",
    raw_result:"raw_result",
}

const table_voice_call_template = {
    id:"id",
    name:"name",
    voice:"voice"
}

const table_voice_call_question = {
    id:"id",
    id_voice_call_template:"id_voice_call_template",
    id_next_question:"id_next_question",
    first_question:"first_question",
    name:"name",
    timeout_recursion:"timeout_recursion"
}

const table_voice_call_answer = {
    id:"id",
    id_voice_call_question:"id_voice_call_question",
    id_next_question:"id_next_question",
    digit_pressed:"digit_pressed",
    say:"say"
}

const table_voice_call_verb = {
    id:"id",
    id_voice_call_question:"id_voice_call_question",
    verb:"verb",
    num_digits:"num_digits",
    phrase:"phrase",
    timeout:"timeout",
    execution_order:"execution_order",
    finish_on_key:"finish_on_key"
}

function buffer_verb(verb){
    //Buffer twiml verb to twiml object
    const voice_param = this.queryStringParameters["voice"];
    switch(verb[table_voice_call_verb["verb"]]){
        case 'gather':
            const finish_on_key = verb[table_voice_call_verb["finish_on_key"]];
            this.twiml.gather({
                action:this.event.requestContext["path"]+"?id_question="+verb[table_voice_call_verb["id_voice_call_question"]]+(voice_param?`&voice=${voice_param}`:"")+(finish_on_key?"&finish_on_key=1":""),
                numDigits : parseInt(verb[table_voice_call_verb["num_digits"]])
            });
            break;
        case 'record':
            this.twiml.record({
                action:this.event.requestContext["path"]+"?id_question="+verb[table_voice_call_verb["id_voice_call_question"]]+(voice_param?`&voice=${voice_param}`:""),
                timeout: verb[table_voice_call_verb["timeout"]],
            });
            break;
        case 'say':
            let phrase = verb[table_voice_call_verb["phrase"]];
            if(this.replace_digits){
                phrase = phrase.replace("<digitsPressed>",this.bodyObj.Digits.split("").join(","))
            }
            this.twiml.say({
                voice:voice_param?voice_param:"alice" //Add checking alice/man/woman in db entry
            },phrase);
            break;
        default:
            console.log(`Verb ${verb} not recognised`);
    }
}

function response(twiml){
    //Used to return HTTP Payload after twiml buffering is done
    const res = twiml.toString();
    console.log(res);
    return {
        statusCode: 200,
        body: twiml.toString(),
        headers: {
            'Content-Type': 'text/xml'
        }
    }
};

async function ask_question(id_question, obj){
    //Look for the question
    const questions = await obj.db.query(`SELECT * FROM ${table_names["voice_call_question"]} WHERE ${table_voice_call_question["id"]} = ${id_question}`)
    if(!questions.length){
        //Question wasn't found
        console.log("Question wasn't found");
        obj.twiml.hangup();
        return response(obj.twiml);
    }
    //Question found
    console.log("Question found: ",questions[0])
    //Loop over verbs
    const sql_query = `SELECT * FROM ${table_names["voice_call_verb"]} WHERE ${table_voice_call_verb["id_voice_call_question"]} = ${id_question}`
    console.log(sql_query)
    const verbs = await obj.db.query(sql_query)
    console.log(`Found ${verbs.length} verbs associated to this question`)
    
    verbs.forEach(buffer_verb.bind(obj));

    if(questions[0]["timeout_recursion"]){
        //Reconstruct URL:
        const qsp = obj.event.queryStringParameters;
        let url_params = Object.keys(qsp).map((x)=>{return x+"="+qsp[x]}).join("&")
        let URL = obj.event.requestContext["path"]+"?"+url_params
        console.log("Timeout recursion on, adding redirect to this URL:",URL)
        //Buffer redirect to reask the question
        obj.twiml.redirect({
            method:'GET'
        },URL)
        await obj.db.close();
        return response(obj.twiml);
    }else{
        await obj.db.close();
        return response(obj.twiml);
    }
    
}

exports.handler = async (event) => {
    console.log("Event: "+JSON.stringify(event));

    var twiml = new VoiceResponse();

    const bodyObj = queryParser.parse(event.body);

    const queryStringParameters = event["queryStringParameters"];
    console.log("queryStringParameters = "+JSON.stringify(queryStringParameters));

    if(!queryStringParameters || !queryStringParameters["id_question"]){
        //Question not specified:
        console.log("Question wasn't specified");
        twiml.hangup();
        return response(twiml);
    }

    const db = sworm.db();
    
    const obj = {
        twiml:twiml,
        queryStringParameters:queryStringParameters,
        event:event,
        bodyObj:bodyObj,
        db:db
    }
    
    try{
        console.log("Connecting to database");
        console.log(`${user}@${host}:${port}`)
        await db.connect({
                driver: db_driver,
                config: {
                    user: user,
                    password: password,
                    host: host,
                    server: host,
                    port: parseInt(port),
                    database: db_name
                    }   
        });

        console.log("Connected to database");


        if(!bodyObj["Digits"] || 0 /*ADD TEST CONDITION FOR RecordedAudio URL*/){
            //This is the first question
            console.log("First question in the survey");
            const id_question = queryStringParameters["id_question"];
            return await ask_question(id_question,obj);

        }else{
            //This is an answer
            console.log("This is an answer")
            

            //Locate question answered via id_question
            const id_question = queryStringParameters["id_question"];

            //Locate id_voice_call_request through callSid
            const call_sid = bodyObj["CallSid"]
            const req_query = `SELECT * FROM ${table_names["voice_call_request"]} WHERE ${table_voice_call_request["twilio_voice_id"]} = '${call_sid}'`
            console.log(req_query)
            const survey_requests = await db.query(req_query)

            //Save results to results table
            if(survey_requests.length){
                const raw_res = JSON.stringify(decodeURIComponent(event.body));
                const id_voice_call_request = survey_requests[0][table_voice_call_request["id"]]
                const ins_query = `INSERT INTO ${table_names["voice_call_result"]}(${table_voice_call_result["raw_result"]},${table_voice_call_result["id_voice_call_request"]},${table_voice_call_result["id_voice_call_question"]}) VALUES(${raw_res},${id_voice_call_request},${id_question})`
                console.log(ins_query)
                await db.query(ins_query)
            }else{
                console.log("Couldn't locate the voice_call_request associated to this answer")
                //Save raw answer to DB
                const raw_res = JSON.stringify(decodeURIComponent(event.body));
                const ins_query = `INSERT INTO ${table_names["voice_call_result"]}(${table_voice_call_result["raw_result"]}) VALUES(${raw_res})`
                console.log(ins_query)
                await db.query(ins_query)
            }
            

            //If finish_on_key parameter is passed, get the answer with digit_pressed = "#" else, proceed like it's a menu
            const answerDigit =queryStringParameters["finish_on_key"]?"#":bodyObj["Digits"]

            //Locate answer record via id_question and digit_pressed
            console.log("This is an answer, looking for the corresponding answer records:");
            const sql_query = `SELECT * FROM ${table_names["voice_call_answer"]} WHERE ${table_voice_call_answer["id_voice_call_question"]} = ${id_question} AND ${table_voice_call_answer["digit_pressed"]} LIKE "${answerDigit}"`
            console.log(sql_query)
            const answers = await db.query(sql_query)

            let corresponding_answer;

            if(!answers.length)
            {
                const invalid_answer_query = `SELECT * FROM ${table_names["voice_call_answer"]} WHERE ${table_voice_call_answer["id_voice_call_question"]} = ${id_question} AND ${table_voice_call_answer["digit_pressed"]} LIKE "?"`
                console.log(invalid_answer_query)
                const invalid_answers = await db.query(invalid_answer_query)
                if(!invalid_answers.length){
                    twiml.say({
                        voice:queryStringParameters["voice"]?queryStringParameters["voice"]:"alice" //Add checking alice/man/woman in db entry
                    },"Sorry, I don't recognise that answer, goodbye");
                    //No answers
                    twiml.hangup();

                    return response(twiml);
                }else{
                    corresponding_answer = invalid_answers[0]
                }
            }else{
                corresponding_answer = answers[0]
            }

            //Buffer Twilio say verb (if exists)
            const say_content = corresponding_answer[table_voice_call_answer["say"]];
            twiml.say({
                voice:queryStringParameters["voice"]?queryStringParameters["voice"]:"alice" //Add checking alice/man/woman in db entry
            },say_content);
            
            //Answer has id_next_question?
            let id_next_question;
            if(corresponding_answer[table_voice_call_answer["id_next_question"]]){
                id_next_question = corresponding_answer[table_voice_call_answer["id_next_question"]]
            }else{
                //Get answered question record:
                const question = await db.query(`SELECT * FROM ${table_names["voice_call_question"]} WHERE ${table_voice_call_question["id"]} = ${id_question}`)
                id_next_question = question[0][table_voice_call_question["id_next_question"]]
            }

            if(queryStringParameters["finish_on_key"]){
                obj["replace_digits"] = true;
            }
            return await ask_question(id_next_question,obj);
        }   

    }catch(err){
        console.log("Caught error during database access: ", err);
    }
    
    return response(twiml);
   
 };