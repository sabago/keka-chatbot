import { motion } from 'framer-motion';
import {
  ClipboardDocumentListIcon,
  HeartIcon,
  HomeModernIcon,
  BuildingOffice2Icon,
  CreditCardIcon,
  WrenchScrewdriverIcon,
  ShoppingBagIcon,
  PhoneIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  UserIcon,
  EllipsisHorizontalCircleIcon,
} from '@heroicons/react/24/outline';
import Button from '../ui/Button';
import type { Button as ButtonType } from '../../types';

interface ChipTrayProps {
  buttons: ButtonType[];
  onButtonClick: (value: string, label: string) => void;
  disabled?: boolean;
}

// Map button values to icons
const getButtonIcon = (value: string) => {
  const iconClass = "w-4 h-4";

  if (value.includes('start_intake')) return <ClipboardDocumentListIcon className={iconClass} />;
  if (value.includes('therapy_rehab')) return <HeartIcon className={iconClass} />;
  if (value.includes('home_care')) return <HomeModernIcon className={iconClass} />;
  if (value.includes('business')) return <BuildingOffice2Icon className={iconClass} />;
  if (value.includes('insurance')) return <CreditCardIcon className={iconClass} />;
  if (value.includes('equipment')) return <WrenchScrewdriverIcon className={iconClass} />;
  if (value.includes('community')) return <ShoppingBagIcon className={iconClass} />;
  if (value.includes('contact_me')) return <UserIcon className={iconClass} />;
  if (value.includes('something_else')) return <EllipsisHorizontalCircleIcon className={iconClass} />;
  if (value.includes('phone')) return <PhoneIcon className={iconClass} />;
  if (value.includes('email')) return <EnvelopeIcon className={iconClass} />;
  if (value.includes('resolved')) return <CheckCircleIcon className={iconClass} />;
  if (value.includes('home') || value.includes('back')) return <ArrowLeftIcon className={iconClass} />;

  return null;
};

export default function ChipTray({ buttons, onButtonClick, disabled = false }: ChipTrayProps) {
  if (!buttons || buttons.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      className="flex flex-wrap gap-2 px-4 py-2"
      role="group"
      aria-label="Quick reply options"
    >
      {buttons.map((button, index) => {
        const isStartIntake = button.value.includes('start_intake');
        const variant = isStartIntake ? 'primary' : 'default';
        const icon = getButtonIcon(button.value);

        return (
          <Button
            key={index}
            variant={variant}
            onClick={() => onButtonClick(button.value, button.label)}
            disabled={disabled}
            aria-label={button.label}
          >
            {icon && <span className="mr-1.5">{icon}</span>}
            {button.label}
          </Button>
        );
      })}
    </motion.div>
  );
}
