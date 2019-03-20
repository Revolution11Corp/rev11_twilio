const AWS = require("aws-sdk");

var params = {
  FunctionName: 'Your-Function-Name', /* required */
  Environment: {
    Variables: {
      'TABLE_NAME': 'Your-New-Dynamo-Table-Name'
    }
  }
};
AWS.Lambda.updateFunctionConfiguration(params, function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else     console.log(data);           // successful response
});