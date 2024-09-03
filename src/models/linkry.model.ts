import {
  InferCreationAttributes,
  InferAttributes,
  Model,
  CreationOptional,
  DataTypes,
} from "@sequelize/core";
import {
  AllowNull,
  Attribute,
  CreatedAt,
  NotNull,
  PrimaryKey,
  Table,
  UpdatedAt,
} from "@sequelize/core/decorators-legacy";

@Table({ timestamps: true, tableName: "short_links" })
export class ShortLinkModel extends Model<
  InferAttributes<ShortLinkModel>,
  InferCreationAttributes<ShortLinkModel>
> {
  @Attribute(DataTypes.STRING)
  @PrimaryKey
  declare slug: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare full: string;

  @Attribute(DataTypes.ARRAY(DataTypes.STRING))
  @AllowNull
  declare groups?: CreationOptional<string[]>;

  @Attribute(DataTypes.STRING)
  declare author: string;

  @Attribute(DataTypes.DATE)
  @CreatedAt
  declare createdAt: CreationOptional<Date>;

  @Attribute(DataTypes.DATE)
  @UpdatedAt
  declare updatedAt: CreationOptional<Date>;
}
