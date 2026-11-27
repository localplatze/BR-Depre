import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';

const MASCOT = require('../../assets/brand/mascote-temporada.png');

export function CryingBallLogo({ size = 196, animated = true, decorative = false, style }) {
  const [bob] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (!animated) return undefined;
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, [animated]);

  useEffect(() => {
    if (!animated || reduceMotion) {
      bob.setValue(0);
      return undefined;
    }
    const float = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    float.start();
    return () => float.stop();
  }, [animated, bob, reduceMotion]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  return (
    <Animated.Image
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : 'Brasileirão da Depressão: bola de futebol chorando com coroa'}
      source={MASCOT}
      resizeMode="contain"
      style={[styles.mascot, { width: size, height: size, transform: [{ translateY }] }, style]}
    />
  );
}

const styles = StyleSheet.create({ mascot: { alignSelf: 'center' } });
