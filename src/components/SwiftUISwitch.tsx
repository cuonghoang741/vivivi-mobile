import React from 'react';
import { Host, Switch } from '@expo/ui/swift-ui';

interface SwiftUISwitchProps {
  label: string;
  checked: boolean;
  onValueChange: (checked: boolean) => void;
  variant?: 'switch' | 'checkbox';
  color?: string;
}

/**
 * SwiftUI Switch/Toggle component
 */
export const SwiftUISwitch: React.FC<SwiftUISwitchProps> = ({
  label,
  checked,
  onValueChange,
  variant = 'switch',
  color,
}) => {
  return (
    <Host matchContents>
      <Switch
        value={checked}
        onValueChange={onValueChange}
        label={label}
        variant={variant}
        color={color}
      />
    </Host>
  );
};

