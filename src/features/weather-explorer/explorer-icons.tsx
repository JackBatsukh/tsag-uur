import type { SVGProps } from "react";

import { SpriteIcon } from "@/components/sprite-icon";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "name">;

export const MenuIcon = (props: IconProps) => <SpriteIcon name="menu" {...props} />;
export const CloseIcon = (props: IconProps) => <SpriteIcon name="close" {...props} />;
export const SearchIcon = (props: IconProps) => <SpriteIcon name="search" {...props} />;
export const LayersIcon = (props: IconProps) => <SpriteIcon name="layers" {...props} />;
export const PlayIcon = (props: IconProps) => <SpriteIcon name="play" {...props} />;
export const PauseIcon = (props: IconProps) => <SpriteIcon name="pause" {...props} />;
export const ChevronIcon = (props: IconProps) => <SpriteIcon name="arrow" {...props} />;
export const MapPinIcon = (props: IconProps) => <SpriteIcon name="location" {...props} />;
export const LiteIcon = (props: IconProps) => <SpriteIcon name="lite" {...props} />;
export const InfoCircleIcon = (props: IconProps) => <SpriteIcon name="info" {...props} />;
