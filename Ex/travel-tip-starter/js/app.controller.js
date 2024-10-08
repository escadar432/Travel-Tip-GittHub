import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

var gUserPos = null

window.onload = onInit

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
}

function onInit() {
    getFilterByFromQueryParams()
    loadAndRenderLocs()
    mapService.initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(onAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()

    var strHTML = locs.map(loc => {
        const className = (loc.id === selectedLocId) ? 'active' : ''
        var distanceStr = ''
        if (gUserPos) {
            const distance = utilService.getDistance(gUserPos, loc.geo)
            distanceStr = ` (${distance} km away)`
        }
        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
                ${distanceStr}
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}` : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
            </div>     
        </li>`
    }).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onRemoveLoc(locId) {
    var res = onRemoveSwalAlert("Are you sure you want to delete item?")
    res.then((result) => {
        if (result.isConfirmed) { //user said yes, delete loc from serivce 
            locService.remove(locId)
                .then(() => {
                    flashMsg('Location removed')
                    unDisplayLoc()
                    loadAndRenderLocs()
                })
                .catch(err => {
                    console.error('OOPs:', err)
                    flashMsg('Cannot remove location,Try again later')
                })
            return
        } else if (result.isDenied) {
            return "no"
        } else if (result.dismiss) {
            return 'no answer'
        }
    })
        .catch((err) => {
            console.error("Error:", err);
        })
}

function onRemoveSwalAlert(title) {
    var res = Swal.fire({
        title,
        showDenyButton: true,
    })
    return res
}
function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

function onAddLoc(geo) {
    // const locName = prompt('Loc name', geo.address || 'Just a place')
    // if (!locName) return
    const dialog = document.getElementById('loc-dialog')
    const form = document.getElementById('loc-form')

    dialog.dataset.geo = JSON.stringify(geo)
    document.getElementById('dialog-title').innerText = 'Add Location'

    form.reset() // Clear the form inputs
    dialog.showModal()// Open the dialog

    form.onsubmit = () => {
        const locName = document.getElementById('loc-name').value
        const locRate = parseInt(document.getElementById('loc-rate').value, 10)

        const loc = {
            name: locName,
            rate: locRate,
            // rate: +prompt(`Rate (1-5)`, '3'),
            // geo
            geo: JSON.parse(dialog.dataset.geo), // Retrieve geo data from dialog dataset
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
        locService.save(loc)
            .then((savedLoc) => {
                // flashMsg(`Added Location (id: ${savedLoc.id})`)
                // utilService.updateQueryParams({ locId: savedLoc.id })
                flashMsg(`Added Location (id: ${savedLoc.id})`)
                loadAndRenderLocs()
            })
            .catch(err => {
                // console.error('OOPs:', err)
                // flashMsg('Cannot add location')
                flashMsg('Error adding location')
                console.error(err)
            })
        dialog.close()
    }
}

function loadAndRenderLocs() {
    locService.query()
        .then(renderLocs)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {
    mapService.getUserPosition()
        .then(latLng => {
            gUserPos = latLng
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err.message || err)
            flashMsg('Cannot get your position')
        })
}

function onUpdateLoc(locId) {
    // locService.getById(locId)
    //     .then(loc => {
    //         const rate = prompt('New rate?', loc.rate)
    //         if (rate && rate !== loc.rate) {
    //             loc.rate = rate
    //             locService.save(loc)
    //                 .then(savedLoc => {
    //                     flashMsg(`Rate was set to: ${savedLoc.rate}`)
    //                     loadAndRenderLocs()
    //                 })
    //                 .catch(err => {
    //                     console.error('OOPs:', err)
    //                     flashMsg('Cannot update location')
    //                 })

    //         }
    //     })
    const dialog = document.getElementById('loc-dialog')
    const form = document.getElementById('loc-form')

    locService.getById(locId)
        .then(loc => {
            document.getElementById('dialog-title').innerText = 'Update Location'

            // Pre-fill the form with the current location data
            document.getElementById('loc-name').value = loc.name
            document.getElementById('loc-rate').value = loc.rate

            dialog.showModal() // Open the dialog

            form.onsubmit = () => {
                const locName = document.getElementById('loc-name').value
                const locRate = parseInt(document.getElementById('loc-rate').value, 10)

                loc.name = locName
                loc.rate = locRate
                loc.updatedAt = Date.now()

                locService.save(loc)
                    .then(savedLoc => {
                        flashMsg(`Updated Location (id: ${savedLoc.id})`)
                        loadAndRenderLocs()
                    })
                    .catch(err => {
                        flashMsg('Error updating location')
                        console.error(err)
                    });

                dialog.close() // Close the dialog after submit
            }
        })
        .catch(err => {
            flashMsg('Error fetching location details')
            console.error(err)
        })
}

function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address || 'No address available'
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)

    if (gUserPos) {
        const distance = utilService.getDistance(gUserPos, loc.geo)
        el.querySelector('.loc-rate').innerHTML += ` (${distance} km away)`
    }

    el.querySelector('[name=loc-copier]').value = window.location
    el.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getFilterByFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const txt = queryParams.get('txt') || ''
    const minRate = queryParams.get('minRate') || 0
    locService.setFilterBy({ txt, minRate })

    document.querySelector('input[name="filter-by-txt"]').value = txt
    document.querySelector('input[name="filter-by-rate"]').value = minRate
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        handleStats(stats, 'loc-stats-rate')
    })

    locService.getLocCountByUpdatedMap().then(stats => {
        handleStats(stats, 'loc-stats-updated')
    })
}

function handleStats(stats, selector) {
    // stats = { low: 37, medium: 11, high: 100, total: 148 }
    // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
    const labels = cleanStats(stats)
    const colors = utilService.getColors()

    console.log("stats are:",stats)
    
    console.log("selector are:",selector)

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`
    // Example:
    // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels.map((label, idx) => {
        return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    }).join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}
