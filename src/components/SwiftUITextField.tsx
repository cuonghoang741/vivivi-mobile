import React from 'react';
import { Host, TextField } from '@expo/ui/swift-ui';

interface SwiftUITextFieldProps {
  defaultValue?: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  autocorrection?: boolean;
  secureTextEntry?: boolean;
}

/**
 * SwiftUI TextField component
 */
export const SwiftUITextField: React.FC<SwiftUITextFieldProps> = ({
  defaultValue,
  placeholder,
  onChangeText,
  autocorrection = true,
  secureTextEntry = false,
}) => {
  return (
    <Host matchContents>
      <TextField
        defaultValue={defaultValue}
        placeholder={placeholder}
        onChangeText={onChangeText}
        autocorrection={autocorrection}
        secureTextEntry={secureTextEntry}
      />
    </Host>
  );
};

