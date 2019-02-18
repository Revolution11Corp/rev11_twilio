# rev11-twilio

Serverless application for fetching survey request DB records and injecting a request into Twilio via API. This function requires an SQL Hosted database with the following Parameters:

SERVER - The URL of the server where the database is hosted.

PORT - Port on which the database is accessible.

DATABASE - Name of the database where the tables are saved.

DRIVER - "The SQL platform were the database is hosted, can be one of the following: 'mssql', 'mysql', 'pg', 'oracle', 'sqlite' or 'websql'"

ACCOUNT - Name of an account that has read privileges to the database.

PASSWORD - The password for ACCOUNT above.

Made with ❤️ by Revolution11. Available on the [AWS Serverless Application Repository](https://aws.amazon.com/serverless)