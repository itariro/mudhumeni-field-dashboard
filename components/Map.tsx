/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import MapComponent, { Layer, MapRef, Marker } from "react-map-gl/mapbox"
import "mapbox-gl/dist/mapbox-gl.css"
import CoordinatesDisplay from "./CoordinatesDisplay"
import WeatherDisplay from "./WeatherDisplay"
import CurrentLocationButton from "./CurrentLocationButton"
import SearchBar from "./SearchBar"
import { LoadingSpinner } from "./ui/circular-spinner"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import ChangeMapStyleButton from "./ChangeMapStyleButton"
import { MapPin } from "lucide-react"
import Controls from "./Controls"
import DonationDialog from "./DonationDialog"
import { useCoordinates } from "@/hooks/useCoordinates"

/**
 * Available map styles for the application
 */
const MAP_STYLES = {
    STREETS: {
        light: "mapbox://styles/mapbox/streets-v12",
        dark: "mapbox://styles/mapbox/dark-v11"
    },
    SATELLITE: {
        light: "mapbox://styles/mapbox/satellite-streets-v12",
        dark: "mapbox://styles/mapbox/satellite-streets-v12"
    }
} as const

/**
 * Represents geographical coordinates with latitude and longitude
 */
interface Coordinates {
    longitude: number
    latitude: number
}

// ~2km threshold (about the size of a small city neighborhood)
const MOVEMENT_THRESHOLD = 0.02;

export default function Map() {
    // Context for coordinates
    const { coordinates, setCoordinates, selectedLocation, setSelectedLocation } = useCoordinates()
    
    // Other state Management
    const [mapRef, setMapRef] = useState<{ current?: MapRef }>({})
    const [loading, setLoading] = useState(true)
    const [zoom, setZoom] = useState(mapRef.current?.getZoom() || 0)
    const { resolvedTheme } = useTheme()
    const [mapStyle, setMapStyle] = useState<'STREETS' | 'SATELLITE'>('STREETS')
    const [lastWeatherCoordinates, setLastWeatherCoordinates] = useState<Coordinates | null>(null)

    // Ref callback to store the map reference
    const measuredRef = React.useCallback((node: any) => node && setMapRef({ current: node }), [])

    /**
     * Handles map movement and updates coordinates and zoom level
     */
    const handleMove = React.useCallback(
        (event: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
            const { longitude, latitude, zoom } = event.viewState
            setCoordinates({ longitude, latitude })
            setZoom(zoom)

            if (lastWeatherCoordinates) {
                const distanceMoved = Math.sqrt(
                    Math.pow(longitude - lastWeatherCoordinates.longitude, 2) +
                    Math.pow(latitude - lastWeatherCoordinates.latitude, 2)
                )

                if (distanceMoved > MOVEMENT_THRESHOLD) {
                    setLastWeatherCoordinates({ longitude, latitude })
                }
            } else {
                setLastWeatherCoordinates({ longitude, latitude })
            }
        },
        [lastWeatherCoordinates, setCoordinates]
    )

    /**
     * Updates map coordinates and animates to the new location
     * @param newCoordinates - The new coordinates to fly to
     */
    const updateCoordinates = (newCoordinates: Coordinates) => {
        setCoordinates(newCoordinates)
        mapRef.current?.flyTo({
            center: [newCoordinates.longitude, newCoordinates.latitude],
            zoom: 16,
            pitch: 60,
            bearing: -20,
        })
        setSelectedLocation(newCoordinates)
        setLastWeatherCoordinates(newCoordinates)
    }

    /**
     * Handles location selection from the search bar
     * @param longitude - The selected longitude
     * @param latitude - The selected latitude
     */
    const handleSelectLocation = (longitude: number, latitude: number) => {
        const newLocation = { longitude, latitude }
        setSelectedLocation(newLocation)
        updateCoordinates(newLocation)
        setZoom(14)
    }

    /**
     * Reset view to initial state when Ctrl+Q is pressed
     */
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.key === 'q') {
                event.preventDefault()
                mapRef.current?.flyTo({
                    center: [-4.649779746122704, 17.08385049329921],
                    zoom: 2,
                    pitch: 0,
                    bearing: 0,
                })
                setCoordinates({
                    longitude: -4.649779746122704,
                    latitude: 17.08385049329921
                })
                setZoom(2)
                setSelectedLocation(null)
                setLastWeatherCoordinates(null)
            }
        }

        window.addEventListener('keydown', handleKeyPress)
        return () => window.removeEventListener('keydown', handleKeyPress)
    }, [mapRef, setCoordinates, setSelectedLocation, setLastWeatherCoordinates])

    return (
        <>
            <div className="w-full h-full">
                <MapComponent
                    mapboxAccessToken={process.env.MAPBOX_PUBLIC_KEY}
                    ref={measuredRef}
                    style={{
                        width: "100vw",
                        height: "100vh",
                    }}
                    mapStyle={MAP_STYLES[mapStyle][resolvedTheme === 'dark' ? 'dark' : 'light']}
                    projection="globe"
                    onMove={handleMove}
                    onLoad={() => {
                        setLoading(false)
                    }}
                    initialViewState={{
                        longitude: coordinates.longitude,
                        latitude: coordinates.latitude,
                        zoom: 2,
                        pitch: 0,
                        bearing: 0,
                    }}
                >
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-2">
                                <LoadingSpinner />
                                <p className="text-sm text-muted-foreground">Loading map...</p>
                            </div>
                        </div>
                    )}

                    {selectedLocation && (
                        <Marker
                            longitude={selectedLocation.longitude}
                            latitude={selectedLocation.latitude}
                            onClick={() => {
                                setSelectedLocation(null)
                            }}
                            anchor="bottom"
                        >
                            <MapPin className="w-6 h-6 dark:text-white text-black" />
                        </Marker>
                    )}

                    {mapStyle === 'STREETS' && (
                        <Layer
                            id="3d-buildings"
                            source="composite"
                            source-layer="building"
                            type="fill-extrusion"
                            minzoom={15}
                            paint={{
                                "fill-extrusion-color": resolvedTheme === "dark" ? "#444444" : "#aaa",
                                "fill-extrusion-height": ["get", "height"],
                                "fill-extrusion-base": ["get", "min_height"],
                                "fill-extrusion-opacity": 0.6,
                            }}
                        />
                    )}

                    <div className="flex justify-center md:justify-start absolute top-[70px] w-full md:w-auto md:left-4 px-4 md:px-0">
                        <div className="w-full md:max-w-xl max-w-md">
                            <SearchBar onSelectLocation={handleSelectLocation} />
                        </div>
                    </div>

                </MapComponent>

                <CoordinatesDisplay
                    longitude={coordinates.longitude}
                    latitude={coordinates.latitude}
                    zoom={zoom}
                />

                {zoom >= 14 && lastWeatherCoordinates && (
                    <WeatherDisplay
                        longitude={lastWeatherCoordinates.longitude}
                        latitude={lastWeatherCoordinates.latitude}
                    />
                )}

                <div className="absolute bottom-6 right-4 flex flex-row gap-[5px] items-center">
                    <DonationDialog showButton={true} />
                    <Controls />
                    
                    <ChangeMapStyleButton
                        mapStyle={mapStyle}
                        onToggle={() => setMapStyle(current => current === 'STREETS' ? 'SATELLITE' : 'STREETS')}
                    />
                    <CurrentLocationButton onUpdateCoordinates={updateCoordinates} />
                </div>
            </div>
        </>
    )
}
