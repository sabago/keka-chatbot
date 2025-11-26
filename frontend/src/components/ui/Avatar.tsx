import { UserCircleIcon } from "@heroicons/react/24/solid";

interface AvatarProps {
  type: "bot" | "user";
  size?: number;
}

export default function Avatar({ type, size = 48 }: AvatarProps) {
  if (type === "bot") {
    // Make bot icon slightly smaller (85%) to match visual weight of UserCircleIcon
    const botIconSize = Math.round(size * 0.85);
    return (
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        aria-label="Keka Support"
      >
        <img
          src="/keka-logo.png"
          alt="Keka Rehab Services"
          className="object-cover rounded-full"
          style={{ width: botIconSize, height: botIconSize }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      aria-label="You"
    >
      <UserCircleIcon
        className="text-[#FF0000]"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
