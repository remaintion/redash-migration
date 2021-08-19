# Redash Migration

#### Script to migrate dashboard from origin redash 
#### this script will
- import dashboard
- import query
- import visualization
- import widget

### Setup
-	`yarn install`
-	create .env file
	-	`
ORIGIN=https://app.redash.io/${your organization}
ORIGIN_API_KEY=${get from https://app.redash.io/${your organization}/users/me}
DESTINATION=${your hosted target}
DESTINATION_API_KEY=${your target api key}`


### Migration
- Create `meta.json` to store `queries` and `visualizations` cached
- Edit `index.js` copy any dashboard your want to `dashboards` as array
- Edit `mapDatasources` map from redash origin datasource id to new datasource id
- Run `node index.js`