/*
 * Lambda to call for survey triggered by an AWS IoT button.
 */

//Import required dependencies
const sworm = require('sworm');
const tw = require('twilio')

///Get environment variables

//Database credentials
const user = process.env.ACCOUNT;
const password = process.env.PASSWORD;
const host = process.env.SERVER;
const port = process.env.PORT;
const db_name = process.env.DATABASE;
const db_driver= process.env.DRIVER;

//Twilio Auth info
const account_sid = process.env.T_SID;
const auth_token = process.env.T_AUTH;

//Twilio call info
const twilio_number = process.env.T_NUMBER; //Twilio number from which the survey will be conducted

//Webhook URL:
const webhook_url = process.env.WEBHOOK_URL;
//Database info:
//These are hardcoded because they are numerous, but are written in this section for regrouping reasons
/// Might change this to a local dependency
const table_names = {
    survey_request:"survey_request",
    survey_result:"survey_result",
    survey_template:"survey_template",
    survey_template_question:"survey_template_question",
    survey_template_answer:"survey_template_answer",
    survey_template_verb:"survey_template_answer"
}

//Column names for individual tables

const table_survey_request = {
    id:"id",
    id_survey_template:"id_survey_template",
    name:"name",
    phone_num:"phone_num",
    button_serial:"button_serial",
    twilio_survey_id:"twilio_survey_id"
}

const table_survey_template = {
    id:"id",
    voice:"voice",
    name:"name",
}

const table_survey_question = {
    id:"id",
    first_question:"first_question",
    id_survey_template:"id_survey_template",
    name:"name",
    id_next_question:"id_next_question"
}

//Handler function to run when button clicked
exports.handler = async (event) => {

    //Twilio client to send call with
    const client = tw(account_sid, auth_token);

    const db = sworm.db();

    const button_serial = event.deviceInfo.deviceId;

    console.log(`Connecting to ${host}:${port}`)
    console.log("Received event:");
    console.log(JSON.stringify(event));
    //Look for entries in the database that contains button_serial in the "button_serial_col" column 

    const surveys = db.model({
        table: table_names["survey_request"],
        id: table_survey_request["id"]
    });

    if(!twilio_number){
            const err_msg = "No phone number specified in the environment variables"
            console.log(err_msg)
            return JSON.stringify(err_msg)
    }

    if(!webhook_url){
        const err_msg = "No URL for the webhook specified in the environment variables"
        console.log(err_msg)
        return JSON.stringify(err_msg)
    }

    if(!account_sid || !auth_token){
        const err_msg = "Twilio credentials aren't complete in the environment variables"
        console.log(err_msg)
        return JSON.stringify(err_msg)
    }

    try{
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
        console.log(`SELECT * FROM ${table_names["survey_request"]} WHERE ${table_survey_request["button_serial"]} = '${button_serial}' AND (${table_survey_request["twilio_survey_id"]} IS NULL OR ${table_survey_request["twilio_survey_id"]} = "")`);
        const survey_requests = await surveys.query(`SELECT * FROM ${table_names["survey_request"]} WHERE ${table_survey_request["button_serial"]} = '${button_serial}' AND (${table_survey_request["twilio_survey_id"]} IS NULL OR ${table_survey_request["twilio_survey_id"]} = "")`)

        if(!survey_requests.length){
            console.log("Query returned no results, there are no surveys to be made by this button");
            await db.close()
            return JSON.stringify("Query returned no results, there are no surveys to be made by this button");
        }

        //Got surveys to make for this button
        console.log("Query for surveys returned: ", JSON.stringify(survey_requests[0]));

        //Survey template to be performed:
        const id_survey_template = survey_requests[0][table_survey_request["id_survey_template"]];

        const survey_templates = await surveys.query(`SELECT * FROM  ${table_names["survey_template"]} WHERE ${table_survey_template["id"]} = ${id_survey_template}`)
        if(!survey_templates){
            err_msg = "No survey template found that corresponds to the request"
            await db.close()
            return JSON.stringify(err_msg)
        }

        const voice = survey_templates[0][table_survey_template["voice"]]

        //Look for first question for the survey in hand:
        ///Now using the question with the smallest ID, but we should use a tiny int column that specifies the first question to be sent to Twilio

        const questions = await surveys.query(`SELECT * FROM ${table_names["survey_template_question"]} WHERE ${table_survey_question["id_survey_template"]} = ${id_survey_template} AND ${table_survey_question["first_question"]} = 1`)
        if(!questions.length){
            console.log(`There are no questions for this survey. Survey_id: ${id_survey_template}`)
            await db.close()
            return JSON.stringify(`There are no questions for this survey. Survey_id: ${id_survey_template}`)
        }else if(questions.length > 1){
            console.log("There are more than one question marked as 'first question'. Survey will not proceed")
            await db.close();
            return JSON.stringify("There are more than one question marked as 'first question'. Survey will not proceed")
        }
        const first_question = questions[0]
        const id_question = first_question[table_survey_question["id"]]
        
        console.log("Twilio info:")
        console.log("Webhook URL to be called:")
        console.log(`${webhook_url}?id_question=${id_question}`)
        console.log(`Phone number to call from: ${twilio_number}`)
        console.log(`Phone number to call: ${survey_requests[0][table_survey_request["phone_num"]]}`)


        const call = await client.calls.create({
                            url: `${webhook_url}?id_question=${id_question}&voice=${voice}`,
                            to: survey_requests[0][table_survey_request["phone_num"]],
                            from: twilio_number
                        });
        survey_requests[0][table_survey_request["twilio_survey_id"]] = call.sid;
        console.log("Got call ID: ",call.sid," Saving it into the database");
        await survey_requests[0].save();
        await db.close();
        return JSON.stringify("OK");

    }catch(err){
        console.log("Caught error during database access: ", err);
    }

};