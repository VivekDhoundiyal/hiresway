import React from 'react';

export type TypographyVariant =
  'display' | 'h1' | 'h2' | 'h3' | 'body-lg' | 'body-md' | 'body-sm' | 'caption';

export type TypographyColor =
  'primary' | 'secondary' | 'muted' | 'brand' | 'accent' | 'error';

export type TypographyWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  variant?: TypographyVariant;
  color?: TypographyColor;
  weight?: TypographyWeight;
}

const variantStyles: Record<TypographyVariant, string> = {
  display: 'text-display font-bold tracking-tight',
  h1: 'text-h1 font-bold tracking-tight',
  h2: 'text-h2 font-semibold tracking-tight',
  h3: 'text-h3 font-semibold',
  'body-lg': 'text-body-lg leading-relaxed',
  'body-md': 'text-body-md leading-normal',
  'body-sm': 'text-body-sm leading-normal',
  caption: 'text-caption tracking-wider uppercase',
};

const defaultElementMap: Record<TypographyVariant, React.ElementType> = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  'body-lg': 'p',
  'body-md': 'p',
  'body-sm': 'p',
  caption: 'span',
};

const colorStyles: Record<TypographyColor, string> = {
  primary: 'text-text-primary',
  secondary: 'text-text-secondary',
  muted: 'text-text-muted',
  brand: 'text-primary',
  accent: 'text-accent',
  error: 'text-error',
};

const weightStyles: Record<TypographyWeight, string> = {
  regular: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

export const Typography: React.FC<TypographyProps> = ({
  as,
  variant = 'body-md',
  color = 'primary',
  weight,
  children,
  className = '',
  ...rest
}) => {
  const Component = as || defaultElementMap[variant] || 'p';

  return (
    <Component
      className={`
        font-sans
        ${variantStyles[variant]}
        ${colorStyles[color]}
        ${weight ? weightStyles[weight] : ''}
        ${className}
      `}
      {...rest}
    >
      {children}
    </Component>
  );
};
