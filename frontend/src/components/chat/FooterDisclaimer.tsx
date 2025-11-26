import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

export default function FooterDisclaimer() {
  return (
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 leading-relaxed">
      <div className="flex items-start gap-2 justify-center">
        <ShieldExclamationIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
        <p className="m-0 text-center">
          <strong className="text-gray-700">Not for emergencies</strong> — call 911 for urgent needs.
          <br />
          Please do not share medical details or personal health information.
        </p>
      </div>
    </div>
  );
}
