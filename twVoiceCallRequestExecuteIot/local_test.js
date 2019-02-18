require("dotenv").config();
require("./index").handler({ "deviceInfo": { "deviceId": "TESTBUTTON", "type": "button", "remainingLife": 97, "attributes": { "projectRegion": "us-west-2", "projectName": "ATT_LTE-M", "placementName": "RVIOT-4-Roger", "deviceTemplateName": "att_LTE_M" } }, "deviceEvent": { "buttonClicked": { "clickType": "SINGLE", "reportedTime": "2018-11-22T22:24:01.467Z" } }, "placementInfo": { "projectName": "ATT_LTE-M", "placementName": "RVIOT-4-Roger", "attributes": {}, "devices": { "att_LTE_M": "B9GHXT183200293" } } })
.catch(function(err){
    console.log("Caught error during lambda execution.");
    console.log(err);
});

