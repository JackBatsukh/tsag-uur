import { useId, useState } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/icons";
import type { WeatherCoordinates } from "@/features/weather-data";

import {
  DEMO_LOCATIONS,
  findDemoLocation,
} from "./explorer-config";
import { LayersIcon, MenuIcon, SearchIcon } from "./explorer-icons";

interface ExplorerHeaderProps {
  readonly onSelectCoordinates: (coordinates: WeatherCoordinates) => void;
  readonly onRequestMenu: () => void;
  readonly activeLayerLabel: string;
}

export function ExplorerHeader({
  onSelectCoordinates,
  onRequestMenu,
  activeLayerLabel,
}: ExplorerHeaderProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  return (
    <header className="explorer-header">
      <Link className="explorer-brand" href="/" aria-label="Tsag-uur газрын зургийн нүүр">
        <span className="explorer-brand__mark">
          <BrandMark />
        </span>
        <span>
          <strong>Tsag-uur</strong>
          <small>Weather Intelligence</small>
        </span>
      </Link>

      <form
        className="location-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const location = findDemoLocation(query);
          if (!location) {
            setMessage("Жагсаалтад байгаа хотын нэрээс сонгоно уу.");
            return;
          }
          onSelectCoordinates(location.coordinates);
          setMessage(`${location.name} demo цэгийг сонголоо.`);
        }}
      >
        <SearchIcon />
        <label className="sr-only" htmlFor="location-search-input">
          Demo байршил хайх
        </label>
        <input
          id="location-search-input"
          list={listId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Хот, байршил хайх"
          autoComplete="off"
        />
        <datalist id={listId}>
          {DEMO_LOCATIONS.map((location) => (
            <option key={location.id} value={location.name}>
              {location.administrativeArea}
            </option>
          ))}
        </datalist>
        <button type="submit">Хайх</button>
        <span className="sr-only" aria-live="polite">
          {message}
        </span>
      </form>

      <div className="dataset-status" title="Зохиомол хөгжүүлэлтийн өгөгдөл">
        <span aria-hidden="true" />
        <span className="dataset-status__long">Synthetic dataset</span>
        <span className="dataset-status__short">Demo</span>
      </div>

      <button
        className="header-action header-action--layers"
        type="button"
        onClick={onRequestMenu}
        aria-controls="explorer-sidebar"
      >
        <LayersIcon />
        <span>{activeLayerLabel}</span>
      </button>
      <button
        className="header-action header-action--menu"
        type="button"
        onClick={onRequestMenu}
        aria-controls="explorer-sidebar"
        aria-label="Газрын зургийн цэс нээх"
      >
        <MenuIcon />
      </button>
    </header>
  );
}
