# rev11-twilio

Serverless application for managing a Twilio survey database over a RESTful HTTP API.
This serverless app requires an SQL Hosted database with the following Parameters:

SERVER - Database location, via IP or FQN

PORT - Port on which the database is accessible.

DATABASE - Database name

DRIVER - Database driver, can be one of the following: 'mssql', 'mysql', 'pg', 'oracle', 'sqlite'

ACCOUNT - Name of an account that has read privileges to the database.

PASSWORD - The password for ACCOUNT above.

TWILIOSID - Twilio account SID to call from

TWILIOAUTH - Authorization string for Twilio account

TWILIONUMBER - Twilio 'call from' phone number

Made with ❤️ by Revolution11. Available on the [AWS Serverless Application Repository](https://aws.amazon.com/serverless)