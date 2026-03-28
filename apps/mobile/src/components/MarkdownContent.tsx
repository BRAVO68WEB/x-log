import { Fragment } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { marked } from "marked";
import type { Tokens } from "marked";
import { useTheme } from "@/theme/ThemeProvider";

function normalizeText(text: string) {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function MarkdownContent({ markdown }: { markdown: string }) {
  const { colors } = useTheme();
  const source = normalizeText(markdown);
  const tokens = marked.lexer(source || "_Nothing to preview yet._");

  return (
    <ScrollView scrollEnabled={false}>
      <View style={styles.container}>
        {tokens.map((token, index) => (
          <Fragment key={`${token.type}-${index}`}>
            {renderToken(token, colors, `${index}`)}
          </Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

function renderToken(
  token: Tokens.Generic,
  colors: ReturnType<typeof useTheme>["colors"],
  keyPrefix: string
) {
  switch (token.type) {
    case "heading": {
      const heading = token as Tokens.Heading;
      const size =
        heading.depth === 1 ? 30 : heading.depth === 2 ? 24 : heading.depth === 3 ? 20 : 18;
      return (
        <Text
          key={`heading-${keyPrefix}`}
          style={{ color: colors.text, fontSize: size, fontWeight: "800", marginBottom: 10 }}
        >
          {heading.text}
        </Text>
      );
    }
    case "paragraph": {
      const paragraph = token as Tokens.Paragraph;
      return (
        <Text
          key={`paragraph-${keyPrefix}`}
          style={{ color: colors.text, fontSize: 16, lineHeight: 24, marginBottom: 12 }}
        >
          {renderInline(paragraph.tokens || [], colors, keyPrefix)}
        </Text>
      );
    }
    case "text": {
      const text = token as Tokens.Text;
      return (
        <Text
          key={`text-${keyPrefix}`}
          style={{ color: colors.text, fontSize: 16, lineHeight: 24, marginBottom: 12 }}
        >
          {text.text}
        </Text>
      );
    }
    case "space":
      return <View key={`space-${keyPrefix}`} style={{ height: 4 }} />;
    case "blockquote": {
      const blockquote = token as Tokens.Blockquote;
      return (
        <View
          key={`blockquote-${keyPrefix}`}
          style={{
            borderLeftWidth: 4,
            borderLeftColor: colors.accent,
            paddingLeft: 12,
            marginBottom: 12,
          }}
        >
          {blockquote.tokens.map((child, index) =>
            renderToken(child as Tokens.Generic, colors, `${keyPrefix}-${index}`)
          )}
        </View>
      );
    }
    case "list": {
      const list = token as Tokens.List;
      return (
        <View key={`list-${keyPrefix}`} style={{ marginBottom: 12, gap: 8 }}>
          {list.items.map((item, index) => (
            <View key={`item-${keyPrefix}-${index}`} style={styles.listRow}>
              <Text style={{ color: colors.text, fontSize: 16 }}>
                {list.ordered ? `${index + 1}.` : "\u2022"}
              </Text>
              <View style={styles.listContent}>
                {item.tokens.map((child, childIndex) =>
                  renderToken(child as Tokens.Generic, colors, `${keyPrefix}-${index}-${childIndex}`)
                )}
              </View>
            </View>
          ))}
        </View>
      );
    }
    case "code": {
      const code = token as Tokens.Code;
      return (
        <View
          key={`code-${keyPrefix}`}
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: 14,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: colors.text, fontFamily: "monospace" }}>{code.text}</Text>
        </View>
      );
    }
    case "hr":
      return (
        <View
          key={`hr-${keyPrefix}`}
          style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }}
        />
      );
    default:
      return null;
  }
}

function renderInline(
  tokens: Tokens.Generic[],
  colors: ReturnType<typeof useTheme>["colors"],
  keyPrefix: string
) {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (token.type) {
      case "text":
      case "escape":
        return (
          <Text key={key} style={{ color: colors.text }}>
            {"text" in token ? token.text : ""}
          </Text>
        );
      case "strong": {
        const strong = token as Tokens.Strong;
        return (
          <Text key={key} style={{ color: colors.text, fontWeight: "800" }}>
            {renderInline(strong.tokens, colors, key)}
          </Text>
        );
      }
      case "em": {
        const em = token as Tokens.Em;
        return (
          <Text key={key} style={{ color: colors.text, fontStyle: "italic" }}>
            {renderInline(em.tokens, colors, key)}
          </Text>
        );
      }
      case "codespan": {
        const codespan = token as Tokens.Codespan;
        return (
          <Text
            key={key}
            style={{
              color: colors.text,
              backgroundColor: colors.surfaceMuted,
              fontFamily: "monospace",
            }}
          >
            {codespan.text}
          </Text>
        );
      }
      case "link": {
        const link = token as Tokens.Link;
        return (
          <Pressable key={key} onPress={() => void Linking.openURL(link.href)}>
            <Text style={{ color: colors.accent, textDecorationLine: "underline" }}>
              {renderInline(link.tokens, colors, key)}
            </Text>
          </Pressable>
        );
      }
      case "image": {
        const image = token as Tokens.Image;
        return (
          <View key={key} style={{ marginVertical: 8 }}>
            <Image
              source={{ uri: image.href }}
              style={{ width: "100%", height: 220, borderRadius: 16, backgroundColor: colors.surfaceMuted }}
              resizeMode="cover"
            />
            {image.text ? (
              <Text style={{ color: colors.textMuted, marginTop: 6 }}>{image.text}</Text>
            ) : null}
          </View>
        );
      }
      case "br":
        return <Text key={key}>{"\n"}</Text>;
      default:
        return null;
    }
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  listContent: {
    flex: 1,
  },
});
