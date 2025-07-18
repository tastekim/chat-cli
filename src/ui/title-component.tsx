import React from 'react';
import { Box, Text } from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';

export const TitleComponent: React.FC = () => {
  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Gradient name="teen">
        <BigText text="CHAT-CLI" font="block" />
      </Gradient>
      <Box paddingY={1}>
        <Text color="cyan">🌟 A terminal-based chat application for developers worldwide</Text>
      </Box>
      <Box>
        <Text color="yellow">⚠️  Requires Node.js 22.14.0 or higher</Text>
      </Box>
    </Box>
  );
};