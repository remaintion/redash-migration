require('dotenv').config()
const axios = require('axios').default
const fs = require("fs")

// The Redash instance you're copying from:
const ORIGIN = process.env.ORIGIN
const ORIGIN_API_KEY = process.env.ORIGIN_API_KEY

//The Redash account you're copying into:
const DESTINATION = process.env.DESTINATION
const DESTINATION_API_KEY = process.env.DESTINATION_API_KEY

// redash hosted => our hosted
const mapDatasources = {
	"15719": 1, // local
	"15728": 2, // inter
	"22877": 3, // customer reminder
	"40343": 4, // lzada
	"30126": 5, // marketing
	"51033": 6, // QueryResult,
	"16818": 7, //drivehub log,
	"42445": 8, // satisfaction
	"25191": 9, // click house
	"15718": 10 // GA
}


const fixQuery = async (id, queryTerm) => {
	console.log("fixQuery")
	const meta = JSON.parse(fs.readFileSync("meta.json", { encoding: "utf-8" }))
	if (!meta.queries) {
		meta.queries = {}
	}
	if (!meta.visualizations) {
		meta.visualizations = {}
	}
	const origin = axios.create({
		baseURL: ORIGIN,
		headers: { Authorization: `Key ${ORIGIN_API_KEY}` }
	});
	const target = axios.create({
		baseURL: DESTINATION,
		headers: { Authorization: `Key ${DESTINATION_API_KEY}` }
	})

	const matches = queryTerm.match(/query_[0-9]+/g)
	console.log(matches)
	if ((matches || []).length > 0) {
		for (const sindex in matches) {
			const q = matches[sindex]
			const qid = q.split("_")[1]
			let newQid = ""
			if (meta.queries[qid]) {
				newQid = meta.queries[qid].id
			} else {
				const data = await origin.get(`/api/queries/${qid}`).then(r => r.data)
				const newData = await fixQuery(data.id, data.query)
				newQid = newData.id
				meta.queries[qid] = newData
			}
			queryTerm = queryTerm.replace(q, `query_${newQid}`)
			console.log("REPLACEING", q, `query_${newQid}`)
		}
	}

	const data = await origin.get(`/api/queries/${id}`).then(r => r.data)
	const payload = {
		data_source_id: mapDatasources[`${data.data_source_id}`] || 6,
		query: queryTerm,
		is_archived: false,
		description: data.description,
		name: data.name,
		options: data.options
	}
	const newData = await target.post(`/api/queries`, payload).then(r => r.data)
	meta.queries[id] = newData
	fs.writeFileSync("meta.json", JSON.stringify(meta))
	return newData
}

const importDashboard = async slug => {
	let meta = JSON.parse(fs.readFileSync("meta.json", { encoding: "utf-8" }))
	if (!meta.queries) {
		meta.queries = {}
	}
	if (!meta.visualizations) {
		meta.visualizations = {}
	}
	const origin = axios.create({
		baseURL: ORIGIN,
		headers: { Authorization: `Key ${ORIGIN_API_KEY}` }
	});
	const target = axios.create({
		baseURL: DESTINATION,
		headers: { Authorization: `Key ${DESTINATION_API_KEY}` }
	})
	const dashboard = await origin.get(`${ORIGIN}/api/dashboards/${slug}`).then(r => r.data)
	const newDashboard = await target.post("/api/dashboards", { name: dashboard.name }).then(r => r.data)


	for (const index in dashboard.widgets) {
		const widget = dashboard.widgets[index]
		const { visualization } = widget
		const { query } = visualization
		let newQueryID = 0
		let newVID = 0
		let queryResponse = {}
		console.log(`RUN: `, index, slug)
		// create query
		if (query) {
			if (meta.queries[query.id]) {
				newQueryID = meta.queries[query.id].id
			} else {
				const newQuery = await fixQuery(query.id, query.query)
				meta = JSON.parse(fs.readFileSync("meta.json", { encoding: "utf-8" }))
				try {
					console.log("NEW Query:", newQuery.id)
					meta.queries[query.id] = newQuery
					newQueryID = newQuery.id
					queryResponse = newQuery
				} catch (error) {
					console.log(error)
					console.log(JSON.stringify(payload))
					continue
				}
			}
		}
		// create visualizer
		if (visualization) {
			if (meta.visualizations[visualization.id]) {
				newVID = meta.visualizations[visualization.id].id
			} else {
				if (visualization.type !== "TABLE") {
					const payload = {
						name: visualization.name,
						description: visualization.description,
						options: visualization.options,
						type: visualization.type,
						query_id: newQueryID,
					}
					try {
						const vresponse = await target.post(`/api/visualizations`, payload).then(r => r.data).catch(e => console.log(e.message))
						console.log("NEW Visualization:", vresponse.id)
						meta.visualizations[visualization.id] = vresponse
						newVID = vresponse.id
					} catch (error) {
						console.log(error)
						console.log(JSON.stringify(payload))
						continue
					}
				} else {
					if (visualization.query) {
						if (meta.queries[visualization.query.id]) {
							newVID = meta.queries[visualization.query.id].visualizations[0].id
						}
					}

					if (!newVID) {
						newVID = queryResponse.visualizations[0].id
					}
				}
			}
		}

		// create widget
		const payload = {
			dashboard_id: newDashboard.id,
			options: widget.options,
			width: widget.width,
			text: widget.text,
			visualization_id: newVID
		}
		try {
			const wresponse = await target.post('/api/widgets', payload).then(r => r.data).catch(e => console.log(e.message))
			console.log("NEW Widget:", wresponse.id)
		} catch (error) {
			console.log(error)
			console.log(JSON.stringify(payload))
			continue
		}
		await sleep(1000)
	}
	fs.writeFileSync("meta.json", JSON.stringify(meta))
}
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
	const dashboards = [
		// "inter-no-dealer_ref",
		// "nan-dashboard",
		// "marketing-dashboard_5",
		// "bigbrand-marketing-",
		// "reject-cancel-dashboard",
		// "pang-dashboard",
		// "cs-dashboard_1",
		// "commission",
		// "extend-rental",

		// "conversion-v2",
		// "kpi-current-month-",

		// "p-ae-dashboard",
		// "boss-dashboard",
		// "bomb-click",
		// "tv",

		// "faii",
		// "tv_2",
		// "new-dealer-for-accountant-2020",
		// "accountant-2019",
		// "accountant_1",
		// "conversion_2"
	]
	for (const index in dashboards) {
		console.log(" --- ----- ---- ---- ----- -- START:", dashboards[index])
		await importDashboard(dashboards[index])
		console.log(" --- ----- ---- ---- ----- -- END:", dashboards[index])
	}
})()
